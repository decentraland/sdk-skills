#!/usr/bin/env node
// Report Decentraland SDK bugs and limitations to the SDK team, once per issue, with the user's consent.
//
// Usage:
//   report.mjs check --fingerprint <slug>   prints one of: consent:unknown | consent:denied | reported | not-reported
//   report.mjs consent --grant|--deny       records the user's answer for this scene
//   report.mjs submit [--file report.json]  reads the report JSON (stdin by default), queues it and returns;
//                                           a background process sends it
//   report.mjs flush                        sends queued reports now and waits for the result
//   report.mjs status                       prints consent, endpoint and ledger counts
//
// Sending never blocks the agent: submit queues the report and starts a detached background process
// that sends it; check starts one only when reports are already queued. A slow or unreachable
// service costs the user no time.
//
// State lives in the scene folder, so every process that touches a scene shares it whatever its HOME
// or however the path is spelled: the ledger (.dcl-sdk-reports.json, with the consent and the queued
// and sent reports) and two lock files (.dcl-sdk-reports.lock around every ledger change, and
// .dcl-sdk-reports.send.lock for the one background run allowed at a time). All of them match
// `.dcl-sdk-reports*`, which is added to .gitignore and to an existing .dclignore, so none is ever
// committed or deployed.
//
// Options:
//   --dir DIR   scene folder (default: nearest parent of the cwd containing scene.json, else the cwd)
//
// Environment:
//   DCL_SDK_ISSUE_REPORTS=off         disables reporting everywhere (wins over a granted consent)
//   DCL_SDK_ISSUE_REPORTS_URL=<url>   overrides the reporting endpoint (base URL; /reports is appended);
//                                     `none`, `off` or empty queues reports without sending them
//
// The first line of output is always the machine-readable result; anything after it is for humans.
// Exit codes: 0 for every result above, 2 for invalid input or usage, 1 for unexpected errors.
//
// Requires Node >= 18 (global fetch). No dependencies.

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { homedir, platform } from 'node:os'
import { TextDecoder } from 'node:util'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The reporting service (ops/cloudflare-workers, workers/sdk-issue-reports).
const DEFAULT_ENDPOINT = 'https://sdk-issue-reports.decentraland.org'

const LEDGER_FILE = '.dcl-sdk-reports.json'
const LEDGER_LOCK_FILE = '.dcl-sdk-reports.lock'
const SEND_LOCK_FILE = '.dcl-sdk-reports.send.lock'
const IGNORE_ENTRY = '.dcl-sdk-reports*'
// Ignore lines that already cover every file above, in the forms people write them.
const IGNORE_COVERS = ['.dcl-sdk-reports*', '/.dcl-sdk-reports*', '**/.dcl-sdk-reports*']

// The service gives each report up to 20 seconds of GitHub calls; waiting longer than that keeps
// the background run from giving up on, and later resending, a report the service is still filing.
const REQUEST_TIMEOUT_MS = 30000
// A safety cap on how many reports one background run sends; it normally empties the queue.
const MAX_SENDS_PER_RUN = 50
// A report the service fails on (a 5xx other than 503) is retried after these delays, and given up
// on (marked failed) after MAX_ATTEMPTS such failures, so it cannot block the queue forever and its
// fingerprint can be reported again. Failures to reach the service, or requests to wait, are not the
// report's fault and do not count; a report that has not got through MAX_PENDING_AGE_MS after its
// first try is given up on too.
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]
const MAX_ATTEMPTS = 5
const MAX_PENDING_AGE_MS = 30 * 24 * 60 * 60_000
// A send lock older than a full run belongs to a run that died. A ledger lock is only held around a
// file read and write, so seconds is plenty.
const SEND_LOCK_STALE_MS = 30 * 60_000
const LEDGER_LOCK_STALE_MS = 30_000
const LEDGER_LOCK_WAIT_MS = 5_000
// How many times a ledger change is tried when the lock is lost or a file operation fails.
const LEDGER_ATTEMPTS = 3
// A lock file is written right after it is created, so one that still is not a lock record after
// this long was left empty or partial by a process that died or a full disk, and is stale.
const UNREADABLE_LOCK_STALE_MS = 2_000
// How far in the future a lock's timestamp may be before it is put down to clock skew.
const LOCK_CLOCK_SKEW_MS = 5_000
// A takeover marker (see tryLock) older than this belongs to a process that died mid-takeover.
const TAKEOVER_STALE_MS = 2_000
// How long background runs leave the service alone after it is unreachable or answers 429/503
// without a usable Retry-After, and the bounds any Retry-After is held to.
const DEFAULT_BACKOFF_MS = 10 * 60_000
const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 24 * 60 * 60_000
// How long submit waits for the report on stdin before giving up.
const STDIN_TIMEOUT_MS = 5_000

const KINDS = ['bug', 'limitation', 'docs-gap']
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const LIMITS = { title: 120, description: 10000, workaround: 5000, fingerprint: 120, skill: 80, agent: 40 }
const INPUT_FIELDS = ['title', 'description', 'workaround', 'kind', 'fingerprint', 'skill', 'agent']
// The service refuses bodies over 32 KB; the payload is fitted under this, with room to spare.
const MAX_PAYLOAD_BYTES = 30_000

// Whether a slug carries a secret rather than words: the service's own rule (slugCarriesSecret in
// the generated redaction block below). Slugs reach the issue footer and labels, where the service
// does not redact.
function carriesSecret(slug) {
  return slugCarriesSecret(slug)
}

// ---------------------------------------------------------------------------------------------
// Redaction: generated, do not edit by hand.
//
// This block is the reporting service's redaction (ops/cloudflare-workers,
// workers/sdk-issue-reports/src/logic/redaction/patterns.ts and bip39.ts), bundled with:
//   npx esbuild src/logic/redaction/patterns.ts --bundle --format=esm --platform=neutral
// with its final export statement removed. Change it there and regenerate, so both sides redact
// exactly the same things.
// ---------------------------------------------------------------------------------------------
// src/logic/redaction/bip39.ts
var BIP39_WORDS = new Set("abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice aerobic affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware away awesome awful awkward axis baby bachelor bacon badge bag balance balcony ball bamboo banana banner bar barely bargain barrel base basic basket battle beach bean beauty because become beef before begin behave behind believe below belt bench benefit best betray better between beyond bicycle bid bike bind biology bird birth bitter black blade blame blanket blast bleak bless blind blood blossom blouse blue blur blush board boat body boil bomb bone bonus book boost border boring borrow boss bottom bounce box boy bracket brain brand brass brave bread breeze brick bridge brief bright bring brisk broccoli broken bronze broom brother brown brush bubble buddy budget buffalo build bulb bulk bullet bundle bunker burden burger burst bus business busy butter buyer buzz cabbage cabin cable cactus cage cake call calm camera camp can canal cancel candy cannon canoe canvas canyon capable capital captain car carbon card cargo carpet carry cart case cash casino castle casual cat catalog catch category cattle caught cause caution cave ceiling celery cement census century cereal certain chair chalk champion change chaos chapter charge chase chat cheap check cheese chef cherry chest chicken chief child chimney choice choose chronic chuckle chunk churn cigar cinnamon circle citizen city civil claim clap clarify claw clay clean clerk clever click client cliff climb clinic clip clock clog close cloth cloud clown club clump cluster clutch coach coast coconut code coffee coil coin collect color column combine come comfort comic common company concert conduct confirm congress connect consider control convince cook cool copper copy coral core corn correct cost cotton couch country couple course cousin cover coyote crack cradle craft cram crane crash crater crawl crazy cream credit creek crew cricket crime crisp critic crop cross crouch crowd crucial cruel cruise crumble crunch crush cry crystal cube culture cup cupboard curious current curtain curve cushion custom cute cycle dad damage damp dance danger daring dash daughter dawn day deal debate debris decade december decide decline decorate decrease deer defense define defy degree delay deliver demand demise denial dentist deny depart depend deposit depth deputy derive describe desert design desk despair destroy detail detect develop device devote diagram dial diamond diary dice diesel diet differ digital dignity dilemma dinner dinosaur direct dirt disagree discover disease dish dismiss disorder display distance divert divide divorce dizzy doctor document dog doll dolphin domain donate donkey donor door dose double dove draft dragon drama drastic draw dream dress drift drill drink drip drive drop drum dry duck dumb dune during dust dutch duty dwarf dynamic eager eagle early earn earth easily east easy echo ecology economy edge edit educate effort egg eight either elbow elder electric elegant element elephant elevator elite else embark embody embrace emerge emotion employ empower empty enable enact end endless endorse enemy energy enforce engage engine enhance enjoy enlist enough enrich enroll ensure enter entire entry envelope episode equal equip era erase erode erosion error erupt escape essay essence estate eternal ethics evidence evil evoke evolve exact example excess exchange excite exclude excuse execute exercise exhaust exhibit exile exist exit exotic expand expect expire explain expose express extend extra eye eyebrow fabric face faculty fade faint faith fall false fame family famous fan fancy fantasy farm fashion fat fatal father fatigue fault favorite feature february federal fee feed feel female fence festival fetch fever few fiber fiction field figure file film filter final find fine finger finish fire firm first fiscal fish fit fitness fix flag flame flash flat flavor flee flight flip float flock floor flower fluid flush fly foam focus fog foil fold follow food foot force forest forget fork fortune forum forward fossil foster found fox fragile frame frequent fresh friend fringe frog front frost frown frozen fruit fuel fun funny furnace fury future gadget gain galaxy gallery game gap garage garbage garden garlic garment gas gasp gate gather gauge gaze general genius genre gentle genuine gesture ghost giant gift giggle ginger giraffe girl give glad glance glare glass glide glimpse globe gloom glory glove glow glue goat goddess gold good goose gorilla gospel gossip govern gown grab grace grain grant grape grass gravity great green grid grief grit grocery group grow grunt guard guess guide guilt guitar gun gym habit hair half hammer hamster hand happy harbor hard harsh harvest hat have hawk hazard head health heart heavy hedgehog height hello helmet help hen hero hidden high hill hint hip hire history hobby hockey hold hole holiday hollow home honey hood hope horn horror horse hospital host hotel hour hover hub huge human humble humor hundred hungry hunt hurdle hurry hurt husband hybrid ice icon idea identify idle ignore ill illegal illness image imitate immense immune impact impose improve impulse inch include income increase index indicate indoor industry infant inflict inform inhale inherit initial inject injury inmate inner innocent input inquiry insane insect inside inspire install intact interest into invest invite involve iron island isolate issue item ivory jacket jaguar jar jazz jealous jeans jelly jewel job join joke journey joy judge juice jump jungle junior junk just kangaroo keen keep ketchup key kick kid kidney kind kingdom kiss kit kitchen kite kitten kiwi knee knife knock know lab label labor ladder lady lake lamp language laptop large later latin laugh laundry lava law lawn lawsuit layer lazy leader leaf learn leave lecture left leg legal legend leisure lemon lend length lens leopard lesson letter level liar liberty library license life lift light like limb limit link lion liquid list little live lizard load loan lobster local lock logic lonely long loop lottery loud lounge love loyal lucky luggage lumber lunar lunch luxury lyrics machine mad magic magnet maid mail main major make mammal man manage mandate mango mansion manual maple marble march margin marine market marriage mask mass master match material math matrix matter maximum maze meadow mean measure meat mechanic medal media melody melt member memory mention menu mercy merge merit merry mesh message metal method middle midnight milk million mimic mind minimum minor minute miracle mirror misery miss mistake mix mixed mixture mobile model modify mom moment monitor monkey monster month moon moral more morning mosquito mother motion motor mountain mouse move movie much muffin mule multiply muscle museum mushroom music must mutual myself mystery myth naive name napkin narrow nasty nation nature near neck need negative neglect neither nephew nerve nest net network neutral never news next nice night noble noise nominee noodle normal north nose notable note nothing notice novel now nuclear number nurse nut oak obey object oblige obscure observe obtain obvious occur ocean october odor off offer office often oil okay old olive olympic omit once one onion online only open opera opinion oppose option orange orbit orchard order ordinary organ orient original orphan ostrich other outdoor outer output outside oval oven over own owner oxygen oyster ozone pact paddle page pair palace palm panda panel panic panther paper parade parent park parrot party pass patch path patient patrol pattern pause pave payment peace peanut pear peasant pelican pen penalty pencil people pepper perfect permit person pet phone photo phrase physical piano picnic picture piece pig pigeon pill pilot pink pioneer pipe pistol pitch pizza place planet plastic plate play please pledge pluck plug plunge poem poet point polar pole police pond pony pool popular portion position possible post potato pottery poverty powder power practice praise predict prefer prepare present pretty prevent price pride primary print priority prison private prize problem process produce profit program project promote proof property prosper protect proud provide public pudding pull pulp pulse pumpkin punch pupil puppy purchase purity purpose purse push put puzzle pyramid quality quantum quarter question quick quit quiz quote rabbit raccoon race rack radar radio rail rain raise rally ramp ranch random range rapid rare rate rather raven raw razor ready real reason rebel rebuild recall receive recipe record recycle reduce reflect reform refuse region regret regular reject relax release relief rely remain remember remind remove render renew rent reopen repair repeat replace report require rescue resemble resist resource response result retire retreat return reunion reveal review reward rhythm rib ribbon rice rich ride ridge rifle right rigid ring riot ripple risk ritual rival river road roast robot robust rocket romance roof rookie room rose rotate rough round route royal rubber rude rug rule run runway rural sad saddle sadness safe sail salad salmon salon salt salute same sample sand satisfy satoshi sauce sausage save say scale scan scare scatter scene scheme school science scissors scorpion scout scrap screen script scrub sea search season seat second secret section security seed seek segment select sell seminar senior sense sentence series service session settle setup seven shadow shaft shallow share shed shell sheriff shield shift shine ship shiver shock shoe shoot shop short shoulder shove shrimp shrug shuffle shy sibling sick side siege sight sign silent silk silly silver similar simple since sing siren sister situate six size skate sketch ski skill skin skirt skull slab slam sleep slender slice slide slight slim slogan slot slow slush small smart smile smoke smooth snack snake snap sniff snow soap soccer social sock soda soft solar soldier solid solution solve someone song soon sorry sort soul sound soup source south space spare spatial spawn speak special speed spell spend sphere spice spider spike spin spirit split spoil sponsor spoon sport spot spray spread spring spy square squeeze squirrel stable stadium staff stage stairs stamp stand start state stay steak steel stem step stereo stick still sting stock stomach stone stool story stove strategy street strike strong struggle student stuff stumble style subject submit subway success such sudden suffer sugar suggest suit summer sun sunny sunset super supply supreme sure surface surge surprise surround survey suspect sustain swallow swamp swap swarm swear sweet swift swim swing switch sword symbol symptom syrup system table tackle tag tail talent talk tank tape target task taste tattoo taxi teach team tell ten tenant tennis tent term test text thank that theme then theory there they thing this thought three thrive throw thumb thunder ticket tide tiger tilt timber time tiny tip tired tissue title toast tobacco today toddler toe together toilet token tomato tomorrow tone tongue tonight tool tooth top topic topple torch tornado tortoise toss total tourist toward tower town toy track trade traffic tragic train transfer trap trash travel tray treat tree trend trial tribe trick trigger trim trip trophy trouble truck true truly trumpet trust truth try tube tuition tumble tuna tunnel turkey turn turtle twelve twenty twice twin twist two type typical ugly umbrella unable unaware uncle uncover under undo unfair unfold unhappy uniform unique unit universe unknown unlock until unusual unveil update upgrade uphold upon upper upset urban urge usage use used useful useless usual utility vacant vacuum vague valid valley valve van vanish vapor various vast vault vehicle velvet vendor venture venue verb verify version very vessel veteran viable vibrant vicious victory video view village vintage violin virtual virus visa visit visual vital vivid vocal voice void volcano volume vote voyage wage wagon wait walk wall walnut want warfare warm warrior wash wasp waste water wave way wealth weapon wear weasel weather web wedding weekend weird welcome west wet whale what wheat wheel when where whip whisper wide width wife wild will win window wine wing wink winner winter wire wisdom wise wish witness wolf woman wonder wood wool word work world worry worth wrap wreck wrestle wrist write wrong yard year yellow you young youth zebra zero zone zoo".split(" "));

// src/logic/redaction/patterns.ts
function anyCase(word) {
  return word.replace(/[a-z]/g, (letter) => `[${letter}${letter.toUpperCase()}]`);
}
var HS = "[ \\t\\u00a0\\u3000]";
var SEPARATOR = `${HS}*(?:=>|[:=\\uff1a\\uff1d])${HS}*`;
var KEYWORD = `(?:${[
  "api[ _-]?keys?",
  "private[ _-]?keys?",
  "access[ _-]?key",
  "secret[ _-]?key",
  "client[ _-]?secret",
  "(?:seed|recovery|secret)[ _-]?(?:phrase|words)",
  "secrets?",
  "(?:access|auth|refresh|id)[ _-]?tokens",
  "token",
  "passw(?:or)?ds?",
  "pw",
  "passphrase",
  "pwd",
  "pass",
  "mnemonic",
  "credentials?",
  "auth"
].map(anyCase).join("|")})`;
var SAFE_SUFFIX = `(?:${[
  "ids?",
  "counts?",
  "types?",
  "uris?",
  "urls?",
  "address(?:es)?",
  "standard",
  "expiry",
  "expires(?:at)?",
  "expiration",
  "state",
  "length",
  "path",
  "names?",
  "index",
  "symbol",
  "decimals",
  "balances?",
  "amounts?",
  "field",
  "label",
  "input",
  "placeholder",
  "hint",
  "required",
  "visible",
  "policy",
  "min",
  "max",
  "enabled",
  "disabled",
  "endpoint",
  "prefix",
  "version",
  "mode",
  "status",
  "supply",
  "owner",
  "contract",
  "list",
  "map",
  "set",
  "ref",
  "keys?",
  "room",
  "door",
  "area",
  "zone",
  "chest",
  "item",
  "reward",
  "quest",
  "gate",
  "gated",
  "passage",
  "code",
  "prompt",
  "result",
  "message",
  "error",
  "check",
  "button",
  "ui",
  "screen",
  "panel",
  "timeout",
  "interval",
  "strategy",
  "method",
  "manager",
  "provider",
  "server",
  "domain",
  "issuer",
  "audience",
  "scopes?",
  "ttl",
  "refresh",
  "limit",
  "size",
  "file",
  "dir",
  "host",
  "port",
  "format",
  "storage",
  "store",
  "cache",
  "flow",
  "state",
  "callback",
  "redirect",
  "service",
  "client"
].map(anyCase).join("|")})`;
var NAME = `(?<![\\w-])(?:[\\w-]{0,40}?[_-]|[A-Za-z][a-z0-9]{0,20}(?:[A-Z][a-z0-9]{0,20}){0,4}(?=[A-Z])|)${KEYWORD}(?![a-z])(?<![A-Z]{2})(?=(?<tail>(?:(?:[_-]|(?=[A-Z0-9]))(?!${SAFE_SUFFIX}(?![a-z0-9]))[A-Za-z0-9]{1,20}){0,3}))\\k<tail>(?![\\w-])`;
var SAFE_KEY_PREFIX = "(?:PUBLIC|SORT|CACHE|STORAGE|PARTITION|PRIMARY|FOREIGN|HOT|INPUT|ACTION|JUMP|INTERACT|GLTF|ASSET|MAP|LOOKUP|INDEX|ROW|HASH|DEDUPE|IDEMPOTENCY)[_ -]";
var ENV_SEP = "[_ -]";
function envKeyword(bareKey) {
  const words = [
    "TOKEN",
    "SECRET",
    "PASSWORD",
    "PASSWD",
    "PWD",
    "PW",
    "PASS",
    "PASSPHRASE",
    "MNEMONIC",
    `SEED${ENV_SEP}PHRASE`,
    "CREDENTIALS?",
    "AUTH",
    `API${ENV_SEP}?KEY`,
    `ACCESS${ENV_SEP}KEY${ENV_SEP}ID`,
    `SECRET${ENV_SEP}ACCESS${ENV_SEP}KEY`,
    `ACCESS${ENV_SEP}KEY`,
    `PRIVATE${ENV_SEP}KEY`,
    `SECRET${ENV_SEP}KEY`,
    "[A-Z0-9]{2,12}(?:PASSWORD|PASSWD|TOKEN|SECRET|APIKEY)"
  ];
  if (bareKey)
    words.push(`(?<!${SAFE_KEY_PREFIX})KEY`);
  return `(?:${words.join("|")})`;
}
var CREDENTIAL_ENV_SUFFIX = "(?:V\\d{1,3}|BASE|VALUE|PROD|DEV|STAGING|TEST|LIVE|RAW|HEX|B64|BASE64|\\d{1,3})";
function envName(bareKey) {
  return `(?<![A-Za-z0-9-])(?!(?:ENABLE|DISABLE|SKIP|USE|REQUIRE|ALLOW|NO|IS|HAS)[_-])(?:[A-Z0-9]{1,24}[_-]){0,20}?${envKeyword(bareKey)}(?:[_-]${CREDENTIAL_ENV_SUFFIX}){0,2}(?![A-Za-z0-9_-])`;
}
var ENV_NAME = envName(true);
var ENV_SECRET_NAME = envName(false);
var KEY_NAME = `(?<![A-Za-z0-9-])(?:[A-Z0-9]{1,24}_){0,20}?(?<!${SAFE_KEY_PREFIX})KEY(?![A-Za-z0-9_-])`;
var QUOTED = "(?<q>['\"`\\u201c\\u2018\\u00ab])(?:\\\\.|(?!\\k<q>|[\\u201d\\u2019\\u00bb])[^\\\\\\n])+(?:\\k<q>|[\\u201d\\u2019\\u00bb])";
var ESCAPED_QUOTED = '\\\\"(?:(?!\\\\")[^\\n])+\\\\"';
var HARMLESS_QUOTED = "(?:['\"`](?:include|omit|same-origin|[^\\w\\s]{1,3})['\"`])";
var NOT_A_VALUE = "(?:string|number|boolean|bigint|object|undefined|null|nil|none|any|unknown|never|void|true|false|yes|no|on|off|required|optional|empty|missing|n/a|tbd|todo|redacted|[01]|x{3,}|\\*{3,})(?=$|[\\s,;)}\\]|<\\[&])";
var CODE_READ = "(?:(?:await|new|typeof|yield)\\s|[A-Za-z_$][\\w$.]{0,80}\\(|\\$\\{\\{?|\\$[A-Za-z_]\\w{0,40}(?![\\w$])|%[A-Z_]{1,40}%)";
var CREDENTIAL_TYPE = "(?:Token|Key|Secret|Password|Auth|Credentials?|Mnemonic|Phrase|Pass)";
var TYPE_SUFFIX = "(?:Options|Config|Provider|Response|Request|Type|Data|Info|Pair|Store|Manager|Payload|Params|Result|Props|State|Handler|Service|Client|Chain)";
var CODE_VALUE = `(?:${CODE_READ}|(?!(?:true|false|null|undefined|nil|none)\\.)[A-Za-z_$][\\w$]{0,40}(?:\\??\\.[A-Za-z_$][\\w$]{0,40}){1,8}|(?<=:${HS}{0,20})[A-Z]{1,21}[a-z][A-Za-z]{0,40}(?=[<\\[;|]|${HS}+\\|)|[A-Z][a-z][A-Za-z]{0,30}(?:Token|Key|Auth|Credentials?)(?=$|[\\s,;)}\\]>|])|(?<=:${HS}{0,20})${CREDENTIAL_TYPE}${TYPE_SUFFIX}?(?=[;,)>|\\]]|${HS}*[|=])|\\/(?![\\s*/])[^/\\n]{1,200}\\/[a-z]{0,6}(?=[.\\s,;)]|$)|[a-z]{2,21}(?:[A-Z][a-z]{2,20}){1,4}(?=$|[\\s,;)}\\]])|[A-Z][A-Z0-9]{0,20}_[A-Z0-9_]{1,40}(?=$|[\\s,;)}\\]]))`;
var ENV_CODE_VALUE = `(?:${CODE_READ}|(?:process|import\\.meta|env|config|settings|secrets|vars|this|globalThis|os\\.environ)[.[])`;
var PROSE_START = "(?:the|a|an|it|is|this|that|not|no|none|only|see|via|in|on|was|were|has|have)\\s";
var LINE_VALUE = `[^\\s#](?:[^\\s#]|#(?!\\s)|${HS}+(?![\\s#]|&&|\\|\\||(?:npm|npx|node|yarn|pnpm|bun|sdk-commands)(?:\\s|$)))*`;
function notAValue(code) {
  return `(?![\\s'"\`<\\[{(]|${NOT_A_VALUE}|${code}|${PROSE_START}|\\d{1,6}${HS}*,|\\d{1,6}\\.\\d{1,6}(?![\\w.]))`;
}
function configValue(code) {
  return `${notAValue(code)}(?<value>${LINE_VALUE})`;
}
function inlineValue(code) {
  return `${notAValue(code)}(?![$%]|\\{\\{)(?<value>[^\\s,;}\\])<'"\`]+)`;
}
var SAFE_RANDOM_SHAPES = [
  /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/,
  /^b[a-z2-7]{50,}$/,
  /^[0-9a-f]{40}$/,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^0[xX][0-9a-fA-F]{40}$/,
  /^(?:sha1|sha256|sha384|sha512)-[A-Za-z0-9+/]+=*$/
];
function entropy(token) {
  const counts = new Map();
  for (const char of token)
    counts.set(char, (counts.get(char) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / token.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}
function wordShare(token) {
  let covered = 0;
  for (const run of token.match(/[A-Z]?[a-z]{3,}/g) ?? [])
    covered += run.length;
  return covered / token.length;
}
function classChanges(token) {
  const kind = (char) => /[a-z]/.test(char) ? 0 : /[A-Z]/.test(char) ? 1 : /[0-9]/.test(char) ? 2 : 3;
  let changes = 0;
  for (let i = 1; i < token.length; i++)
    if (kind(token[i]) !== kind(token[i - 1]))
      changes++;
  return changes / (token.length - 1);
}
function looksRandom(token) {
  if (SAFE_RANDOM_SHAPES.some((shape) => shape.test(token)))
    return false;
  if (/^\d+$/.test(token))
    return false;
  if (/^[0-9a-fA-F]+$/.test(token)) {
    return token.length >= 41 || token.length >= 32 && /\d/.test(token) && /[a-f]/i.test(token);
  }
  if (!/\d/.test(token) || !/[A-Za-z]/.test(token))
    return false;
  return entropy(token) >= (token.length >= 32 ? 3.8 : 3.5) && classChanges(token) >= 0.25 && wordShare(token) < 0.5;
}
var RANDOM_CANDIDATE = /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{20,}={0,2}(?![A-Za-z0-9+/=_-])/g;
function redactCandidate(token) {
  if (SAFE_RANDOM_SHAPES.some((shape) => shape.test(token)))
    return token;
  const placeholder = (part) => /^[0-9a-fA-F]+$/.test(part) ? "<HEX_SECRET>" : "<SECRET>";
  const segments = token.split("/");
  const pathLike = segments.length > 1 && segments.some((segment) => /^[a-z][a-z0-9.]{2,}$/.test(segment));
  const name = token.replace(/^\d{1,6}-/, "");
  const snakeName = /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]{1,12})+$/.test(name) && name.split("_").every((part) => part.length <= 12);
  if (!pathLike && !snakeName && looksRandom(token))
    return placeholder(token);
  const parts = token.split(/([/_-])/);
  if (parts.length === 1)
    return token;
  return parts.map((part) => part.length >= 20 && looksRandom(part) ? placeholder(part) : part).join("");
}
function redactRandomStrings(text) {
  return text.replace(RANDOM_CANDIDATE, redactCandidate);
}
var SEED_GAP = /^(?:[\s,;|'"`[\]_-]|\*\s|\d{1,2}[.):-]?\s|\d{1,2}[.)])+$/;
var SEED_WORD = /(?<![A-Za-z])(?:[a-z]{3,8}|[A-Z][a-z]{2,7}|[A-Z]{3,8})(?![A-Za-z])/g;
function redactSeedPhrases(text) {
  const scanned = text.replace(/\\[nrt]/g, "  ");
  const spans = [];
  let runStart = -1;
  let runEnd = -1;
  let runWords = [];
  const close = () => {
    if (runWords.length >= 12 && new Set(runWords).size >= 8)
      spans.push([runStart, runEnd]);
    runWords = [];
  };
  for (const match of scanned.matchAll(SEED_WORD)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const word = match[0].toLowerCase();
    if (!BIP39_WORDS.has(word)) {
      close();
      continue;
    }
    if (runWords.length === 0 || start - runEnd > 8 || !SEED_GAP.test(scanned.slice(runEnd, start))) {
      close();
      runStart = start;
    }
    runWords.push(word);
    runEnd = end;
  }
  close();
  let result = text;
  for (const [start, end] of spans.reverse())
    result = `${result.slice(0, start)}<SEED_PHRASE>${result.slice(end)}`;
  return result;
}
var MAX_SLUG_SEGMENTS = 10;
function slugCarriesSecret(slug) {
  const segments = slug.split("-");
  const hexLength = segments.map((segment) => segment.replace(/^0x/, "")).filter((segment) => /^[0-9a-f]+$/.test(segment)).reduce((total, segment) => total + segment.length, 0);
  const seedWords = segments.filter((segment) => BIP39_WORDS.has(segment)).length;
  return hexLength >= 32 || segments.length > MAX_SLUG_SEGMENTS || seedWords >= 8 || segments.some((segment) => segment.length >= 20 && looksRandom(segment));
}
var AUTH_SCHEME = "(?:Bearer|Basic|Token|Bot|Negotiate|NTLM|DPoP|JWT|ApiKey|GoogleLogin)";
var PARAMETER_SCHEME = "(?:Digest|Signature|AWS4-HMAC-SHA256|OAuth|Hawk)";
var AUTHORIZATION = `(?<![\\w-])((?:\\\\?['"])?:?(?:proxy-|x-)?authorization(?:\\\\?['"])?${SEPARATOR}(?:\\\\?['"])?)`;
var redactConfigValue = (match, ...args) => {
  const {prefix, value} = args[args.length - 1];
  if (keepsWord(prefix, value.replace(/[,;]$/, "")))
    return match;
  const close = value.length > 1 && /[;,]$/.test(value) ? value.slice(-1) : "";
  return `${prefix}<REDACTED>${close}`;
};
var redactInlineValue = (match, ...args) => {
  const {prefix, value} = args[args.length - 1];
  return keepsWord(prefix, value) ? match : `${prefix}<REDACTED>`;
};
function keepsWord(prefix, value) {
  if (!/:\s*$/.test(prefix) || !/^[a-z]{1,20}$/.test(value))
    return false;
  return /[a-z][A-Z]/.test(prefix) || INLINE_WORDS.has(value);
}
var INLINE_WORDS = new Set("input value values data args arg params options opts config cfg env props state entity item result res response body user account wallet identifier keyword expression expected required missing invalid expired empty undefined null none string number field header headers query payload credentials session storage signer provider ctx context req request self it err error msg message text raw json secrets tokens keys token password secret key apikey auth mnemonic failed failure revoked refreshed incorrect wrong reset hidden guest denied rejected accepted granted valid unset changed updated saved stored created removed deleted enabled disabled ok success successful unauthorized forbidden pending".split(" "));
var redactKeyLiteral = (match, ...args) => {
  const {prefix, literal} = args[args.length - 1];
  const value = literal.slice(1, -1);
  const keyLike = looksRandom(value) || value.length >= 12 && /\d/.test(value) && /[A-Za-z]/.test(value) && !/[\s._]/.test(value);
  return keyLike ? `${prefix}${literal[0]}<REDACTED>${literal[literal.length - 1]}` : match;
};
var STEPS = [
  [
    /(?<=^|[^\w.~>-]|:\/\/\/?|:\/\/file)(?:(?:\/mnt\/[a-z]|\/cygdrive\/[a-z]|\/[a-zA-Z](?=\/[Uu]sers\/))\/[Uu]sers|\/(?:Users|home))\/(?!(?:Shared|Public|Guest)(?![\w-]))(?:[^/\s'"`)]{1,40}(?: [^/\s'"`)]{1,40}){0,3}(?=\/)|[^/\s'"`)]+(?: [A-Z][a-z]{1,20}(?![\w/]))?)/gm,
    "~"
  ],
  [
    /(?<![\w])[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)(?!Public(?![\w-]))(?:[^\\/\s'"`)]{1,40}(?: [^\\/\s'"`)]{1,40}){0,3}(?=[\\/])|[^\\/\s'"`)]+(?: [A-Z][a-z]{1,20}(?![\w\\/]))?)/gi,
    "~"
  ],
  [/\\\\wsl(?:\$|\.localhost)\\[^\\\s]{1,40}\\home\\[^\\\s'"`]+/gi, "~"],
  [/(?<![\w.-])[\w.-]{1,32}@[\w.-]{1,63}(?=:~|:\/| [~%$#]| [\w.-]{1,40} [%$#] )/g, "<USER>@<HOST>"],
  [
    /-----BEGIN [A-Z ]{0,40}PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]{0,40}PRIVATE KEY(?: BLOCK)?-----|$)/g,
    "<PRIVATE_KEY>"
  ],
  [
    /(?<![\w+.-])((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?|mssql|sqlserver|clickhouse|nats)(?:\+[a-z0-9]{1,10})?:\/\/)[^\s@]{1,256}@/gi,
    "$1<REDACTED>@"
  ],
  [/(?<![\w+.-])([a-z][a-z0-9+.-]{0,20}:\/\/)[^\s/?#]*@/gi, "$1<REDACTED>@"],
  [
    /((?:infura\.io\/v3|alchemy\.com\/v2|quiknode\.pro|p2pify\.com|rpc\.ankr\.com\/[a-z_]{1,30}|getblock\.io\/[^/\s]{1,40}|blastapi\.io)\/)[A-Za-z0-9_-]{16,}/gi,
    "$1<TOKEN>"
  ],
  [/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9/_-]+/gi, "hooks.slack.com/<TOKEN>"],
  [/(discord(?:app)?\.com\/api\/webhooks\/)\d+\/[\w-]+/gi, "$1<TOKEN>"],
  [new RegExp(`${AUTHORIZATION}(${PARAMETER_SCHEME})${HS}+(?!<)[^\\n]{1,2000}`, "gi"), "$1$2 <TOKEN>"],
  [new RegExp(`${AUTHORIZATION}(${AUTH_SCHEME})(?:${HS}+|%20)(?!<)[^\\s'"\`,;\\\\]+`, "gi"), "$1$2 <TOKEN>"],
  [
    new RegExp(`${AUTHORIZATION}(?!(?:${AUTH_SCHEME}|${PARAMETER_SCHEME})(?![\\w-])|<|${NOT_A_VALUE})[^\\s'"\`,;\\\\]{8,}`, "gi"),
    "$1<TOKEN>"
  ],
  [/\b(Bearer|Basic)(?:[ \t]+|%20|[ \t]*[:=][ \t]*)[A-Za-z0-9._~+/=-]{16,}/g, "$1 <TOKEN>"],
  [
    /\b(Bearer|Basic)(?:[ \t]+|%20|[ \t]*[:=][ \t]*)(?=[A-Za-z._~-]{0,40}[0-9=+/])[A-Za-z0-9._~+/=-]{8,}/gi,
    "$1 <TOKEN>"
  ],
  [
    /(?<![\w-])((?:\\?['"])?(?:set-)?cookie(?:\\?['"])?[ \t]*[:=][ \t]*(?:\\?['"])?)(?=[\w.-]{1,80}=)[^\n'"\\]{1,4000}/gi,
    "$1<REDACTED>"
  ],
  [/(?<![\w-])(-b|--cookie)([ \t]+)(['"]?)[^\n'"]+\3/g, "$1$2$3<REDACTED>$3"],
  [/("name"[ \t]*:[ \t]*"cookie"[ \t]*,[ \t]*"value"[ \t]*:[ \t]*")[^"\n]*"/gi, '$1<REDACTED>"'],
  [/(?<![\w-])(-u|--user)([ \t]+|=)(['"]?)[^\s:'"]+:[^\s'"]+\3/g, "$1$2$3<REDACTED>$3"],
  [
    /(?<![\w-])(--(?:password|passwd|pass|token|api-?key|secret|auth-token|access-token|client-secret|private-key|mnemonic)(?:[ \t]+|=))(?!-)(['"]?)[^\s'"]+\2/gi,
    "$1$2<REDACTED>$2"
  ],
  [/(?<![\w-])(mysql|mysqldump|mariadb)([ \t][^\n]{0,200}?[ \t])-p(?!\s)\S+/g, "$1$2-p<REDACTED>"],
  [
    /(?<![\w-])((?:(?:docker|podman|nerdctl)[ \t]+login|sshpass)(?:[ \t][^\n]{0,200}?)?[ \t]-p(?:[ \t]+|(?=\S)))(?!['"]?(?:\$|\{\{|<))(['"]?)[^\s'"]+\2/g,
    "$1$2<REDACTED>$2"
  ],
  [/(?<=[ \t"'])((?:ssl)?(?:password|passwd|pwd)=)(?![<$\u201c\u2018\u00ab])[^\s'"),;]+/gi, "$1<REDACTED>"],
  [/(\b(?:machine|default)\b[^\n]{0,200}?[ \t]password[ \t]+)(?!\$|\{\{|<)\S+/g, "$1<REDACTED>"],
  [
    /((?:npm|yarn|pnpm)[ \t]+config[ \t]+set[ \t]+\S{0,200}?(?:_auth(?:Token)?|_password|npmAuthToken|npmAuthIdent)(?:[ \t]+|=))(['"]?)[^\s'"]+\2/g,
    "$1$2<REDACTED>$2"
  ],
  [
    /(?<=^|[^\w-]|%[0-9A-Fa-f]{2})eyJ(?=(?<header>[\w-]{1,4000}))\k<header>\.(?=(?<claims>[\w-]{1,4000}))\k<claims>\.[\w-]*/g,
    "<TOKEN>"
  ],
  [/(?<![\w-])sk-(?:proj-|ant-[a-z0-9]{2,10}-|svcacct-|admin-|or-v\d-)?[A-Za-z0-9_-]{20,}/g, "<TOKEN>"],
  [/(?<![\w-])(?:sk|pk|rk)_(?:live_|test_)?[A-Za-z0-9]{16,}/g, "<TOKEN>"],
  [/(?<![\w-])(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g, "<TOKEN>"],
  [/(?<![\w-])(?:glpat|glptt|gldt)-[A-Za-z0-9_-]{20,}/g, "<TOKEN>"],
  [/(?<![\w-])(?:npm|hf|gsk|dckr_pat|sntrys|shpat|shpss|lin_api|whsec)_[A-Za-z0-9_-]{16,}/g, "<TOKEN>"],
  [/(?<![\w-])xai-[A-Za-z0-9]{20,}/g, "<TOKEN>"],
  [/(?<![\w-])xox[abprs]-[A-Za-z0-9-]{10,}/g, "<TOKEN>"],
  [/(?<![\w-])AIza[0-9A-Za-z_-]{35}(?![\w-])/g, "<TOKEN>"],
  [/(?<![\w-])ya29\.[0-9A-Za-z_-]{20,}/g, "<TOKEN>"],
  [/(?<![\w-])GOCSPX-[0-9A-Za-z_-]{20,}/g, "<TOKEN>"],
  [/(?<![\w-])SG\.[\w-]{16,}\.[\w-]{16,}/g, "<TOKEN>"],
  [/(?<![\w-])(?:AKIA|ASIA)[0-9A-Z]{16}(?![\w-])/g, "<TOKEN>"],
  [/(?<![\w-])[MNO][A-Za-z\d]{23,27}\.[\w-]{6}\.[\w-]{27,}/g, "<TOKEN>"],
  [/(?<![\w-])[xt]prv[1-9A-HJ-NP-Za-km-z]{100,112}(?![\w-])/g, "<TOKEN>"],
  redactSeedPhrases,
  [
    new RegExp(`("name"${HS}*:${HS}*"(?:${NAME}|${ENV_NAME}|[Aa]uthorization)"${HS}*,${HS}*"value"${HS}*:${HS}*")[^"\\n]*"`, "g"),
    '$1<REDACTED>"'
  ],
  [
    new RegExp(`(-${HS}+name:${HS}+['"]?(?:${ENV_NAME}|${NAME})['"]?${HS}*\\n${HS}+value:${HS}+)(['"]?)[^\\n'"]+\\2`, "g"),
    "$1$2<REDACTED>$2"
  ],
  [
    new RegExp(`(?<!\\?${HS}{0,20}(?:\\\\?['"])?)((?:\\\\?['"])?(?:${NAME}|${ENV_SECRET_NAME})(?:\\\\?['"])?\\]?${HS}*(?::${HS}*[A-Za-z_][\\w.<>\\[\\]| ]{0,40}?${HS}*)?(?:=>|[:=\\uff1a\\uff1d])${HS}*(?:\\[${HS}*)?)(?!${HARMLESS_QUOTED})${QUOTED}`, "g"),
    "$1$<q><REDACTED>$<q>"
  ],
  [new RegExp(`(\\\\"(?:${NAME}|${ENV_SECRET_NAME})\\\\"${SEPARATOR})${ESCAPED_QUOTED}`, "g"), '$1\\"<REDACTED>\\"'],
  [
    new RegExp(`(?<prefix>(?:\\\\?['"])?${KEY_NAME}(?:\\\\?['"])?${HS}*(?:=>|[:=])${HS}*)(?<literal>${QUOTED})`, "g"),
    redactKeyLiteral
  ],
  [
    new RegExp(`((?:setItem|set|append|setHeader|header|setRequestHeader)\\(${HS}*(?<nq>['"\`])(?:${NAME}|${ENV_NAME}|[Aa]uthorization)\\k<nq>${HS}*,${HS}*)(?!['"\`](?:\\$\\{|\\{\\{)|\`[^\`\\n]{0,40}\\$\\{)${QUOTED}`, "g"),
    "$1$<q><REDACTED>$<q>"
  ],
  [new RegExp(`(<(?:${NAME}|${ENV_NAME})>)(?!\\$|\\{\\{)[^<\\n]{1,500}(?=</)`, "g"), "$1<REDACTED>"],
  [new RegExp(`(key=(?<kq>['"])(?:${NAME}|${ENV_NAME})\\k<kq>${HS}+value=)${QUOTED}`, "gi"), "$1$<q><REDACTED>$<q>"],
  [
    new RegExp(`(?<!\\?${HS}{0,20}(?:\\\\?['"])?)((?:\\\\?['"])(?:${NAME})(?:\\\\?['"])${SEPARATOR})(?![\\s'"\`\\[{<]|\\\\"|${NOT_A_VALUE}|${CODE_VALUE})[^\\s,;}\\]'"\`\\\\]+`, "g"),
    "$1<REDACTED>"
  ],
  [
    new RegExp(`(?<!\\?${HS}{0,20}(?:\\\\?['"])?)((?:\\\\?['"])(?:${ENV_NAME})(?:\\\\?['"])${SEPARATOR})(?![\\s'"\`\\[{<]|\\\\"|${NOT_A_VALUE}|${ENV_CODE_VALUE})[^\\s,;}\\]'"\`\\\\]+`, "g"),
    "$1<REDACTED>"
  ],
  [/(<REDACTED>(['"`]),[ \t]*)(['"`])(?:\\.|(?!\3)[^\\\n])+\3(?![ \t]*[:=])/g, "$1$3<REDACTED>$3"],
  [
    new RegExp(`((?:${NAME}|${ENV_SECRET_NAME})${SEPARATOR}[^\\n'"\`]{1,200}?(?:\\|\\||\\?\\?)${HS}*)${QUOTED}`, "g"),
    "$1$<q><REDACTED>$<q>"
  ],
  [
    new RegExp(`(?<prefix>^${HS}*(?:export${HS}+|set${HS}+|\\$env:|-${HS}+)?${ENV_NAME}${SEPARATOR})${configValue(ENV_CODE_VALUE)}`, "gm"),
    redactConfigValue
  ],
  [
    new RegExp(`(?<prefix>^${HS}*(?:export${HS}+|set${HS}+|\\$env:|-${HS}+)?${NAME}${SEPARATOR})${configValue(CODE_VALUE)}`, "gm"),
    redactConfigValue
  ],
  [new RegExp(`(?<prefix>(?:${ENV_NAME}|${NAME})${SEPARATOR})${inlineValue(CODE_VALUE)}`, "g"), redactInlineValue],
  [
    new RegExp(`((?:-H|--header)${HS}+(?<hq>['"])(?:${NAME}|${ENV_NAME})${HS}*:${HS}*)(?![\\s<]|\\$|\\{\\{)[^'"\\n]+(?=\\k<hq>)`, "g"),
    "$1<REDACTED>"
  ],
  [new RegExp(`(^${HS}*(?:export${HS}+)?SEED${SEPARATOR})${QUOTED}`, "gm"), "$1$<q><REDACTED>$<q>"],
  [
    new RegExp(`(^${HS}*(?:export${HS}+)?SEED${SEPARATOR})(?!\\d{1,30}${HS}*(?:#|$)|['"\`])${LINE_VALUE}`, "gm"),
    "$1<REDACTED>"
  ],
  [new RegExp(`((?:-e|--env|--build-arg|cross-env)${HS}+${ENV_NAME}=)(?!\\$)[^\\s'"]+`, "g"), "$1<REDACTED>"],
  [
    new RegExp(`(^${HS}*\\|${HS}*\`?(?:${ENV_NAME}|${NAME})\`?${HS}*\\|${HS}*)(?!${NOT_A_VALUE})[^|\\s](?:[^|\\s]|${HS}+(?=[^|\\s]))*(?=${HS}*\\|)`, "gm"),
    "$1<REDACTED>"
  ],
  [/(?<![\w-])(_auth(?:Token)?|_password)([ \t]*=[ \t]*)(?!<|\$\{)[^\s'"`]+/g, "$1$2<REDACTED>"],
  [
    /((?:[?&#;]|, )(?:(?:[a-z0-9]{1,30}[_-]){1,3}(?:token|key|secret|signature|sig|auth|password)|access[_-]?token|id_?token|refresh_?token|auth_?token|session[_-]?token|token|api[_-]?key|apikey|key|private[_-]?key|privatekey|secret|client_?secret|signature|sig|x-amz-signature|x-amz-security-token|auth|password|passwd|pass|pwd|passphrase|code_verifier|session[_-]?id|sessionid|session|sid|jwt|seed|mnemonic)=)(?!<|\$\{|\{|(?:true|false|null|undefined)(?![\w-]))[^&\s'"`,;)}\]>]+/gi,
    "$1<REDACTED>"
  ],
  [
    /(?:(?<![0-9a-fA-F])|(?<=[0-9a-fA-F]{40}))0[xX](?:(?!0[xX])[0-9a-fA-F]){41,}(?=[^0-9a-fA-F]|0[xX]|$)/g,
    "<HEX_SECRET>"
  ],
  [
    /(?<!(?:urn:decentraland:[\w:-]{0,80}|erc20|erc721|erc1155|collections-v[12]):)(?<![0-9a-fA-F])0[xX][0-9a-fA-F]{40}(?![0-9a-fA-F])/gi,
    "<ADDRESS>"
  ],
  redactRandomStrings,
  [
    /(?<![\p{L}\p{N}._%+-])(?!git@)[\p{L}\p{N}._%+-]{1,64}(?:@|%40)(?=[\p{L}\p{N}-]{0,62}\p{L})[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63}){0,8}\.(?!(?:png|jpe?g|gif|webp|svg|glb|gltf|ktx2?|mp3|ogg|wav|mp4|ts|tsx|js|mjs|cjs|json|tgz|zip|map|wasm|bin|txt)(?![\p{L}\p{N}-]))\p{L}{2,24}(?![\p{L}\p{N}-])/gu,
    "<EMAIL>"
  ]
];
var REDACTION_STEPS = STEPS;
function redactText(text) {
  let result = text;
  for (const step of STEPS) {
    result = typeof step === "function" ? step(result) : result.replace(step[0], step[1]);
  }
  return result;
}
// ---------------------------------------------------------------------------------------------
// End of the generated redaction block.
// ---------------------------------------------------------------------------------------------

class UsageError extends Error {}

function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith('--')) throw new UsageError(`Unexpected argument: ${arg}`)
    const key = arg.slice(2)
    if (key === 'grant' || key === 'deny' || key === 'background') {
      options[key] = true
    } else if (key === 'fingerprint' || key === 'file' || key === 'dir') {
      const value = rest[++i]
      if (value === undefined) throw new UsageError(`--${key} needs a value`)
      options[key] = value
    } else {
      throw new UsageError(`Unknown option: ${arg}`)
    }
  }
  return { command, options }
}

/** The real path, so every spelling of a scene (symlinks, letter case, /tmp vs /private/tmp) is one scene. */
function realPath(path) {
  try {
    return realpathSync.native(path)
  } catch {
    return resolve(path)
  }
}

function findSceneRoot(start) {
  let current = realPath(start)
  while (true) {
    if (existsSync(join(current, 'scene.json'))) return current
    const parent = dirname(current)
    if (parent === current) return realPath(start)
    current = parent
  }
}

function isDisabledByEnv() {
  const value = (process.env.DCL_SDK_ISSUE_REPORTS || '').trim().toLowerCase()
  return ['off', '0', 'false', 'no', 'disabled'].includes(value)
}

/**
 * The reporting endpoint, or null when sending is off: DCL_SDK_ISSUE_REPORTS_URL set to `none`,
 * `off` or empty (in any case), or to something that is not an https URL (http only on loopback,
 * for local testing).
 */
function getEndpoint() {
  const override = process.env.DCL_SDK_ISSUE_REPORTS_URL
  const value = override === undefined ? DEFAULT_ENDPOINT : override.trim()
  if (['', 'none', 'off'].includes(value.toLowerCase())) return null
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null
  return `${value.replace(/\/+$/, '')}/reports`
}

// ---------------------------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------------------------

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readLedger(root) {
  const path = join(root, LEDGER_FILE)
  if (!existsSync(path)) return null
  let ledger
  try {
    ledger = JSON.parse(decodeText(readFileSync(path)))
  } catch {
    ledger = undefined
  }
  // A ledger that is not what this script writes must not be silently replaced: it may hold the
  // user's consent answer.
  if (!isPlainObject(ledger)) throw new Error(`${path} is not a valid report ledger. Fix or delete it, then run this again.`)
  ledger.reports = Array.isArray(ledger.reports)
    ? ledger.reports.filter(entry => isPlainObject(entry) && typeof entry.clientReportId === 'string')
    : []
  return ledger
}

/**
 * Makes sure `.dcl-sdk-reports*` is in .gitignore (created if missing) and in .dclignore when the scene
 * has one. Appends rather than rewrites, in the file's own line endings, and leaves alone a file that
 * already covers the ledger and its lock files. Best effort: a read-only ignore file must not stop
 * the user's answer from being recorded, or the agent would ask again on every issue.
 */
function ensureIgnored(root) {
  let ignored = true
  for (const [name, createIfMissing] of [
    ['.gitignore', true],
    ['.dclignore', false]
  ]) {
    const path = join(root, name)
    try {
      if (!existsSync(path) && !createIfMissing) continue
      const content = existsSync(path) ? readFileSync(path, 'utf8') : ''
      const lines = content.split(/\r?\n/).map(line => line.trim())
      if (lines.some(line => IGNORE_COVERS.includes(line))) continue
      const eol = content.includes('\r\n') ? '\r\n' : '\n'
      const separator = content === '' || content.endsWith('\n') ? '' : eol
      appendFileSync(path, `${separator}${IGNORE_ENTRY}${eol}`)
    } catch {
      ignored = false
    }
  }
  if (!ignored) ignoreFailed = true
}

// Set when an ignore file could not be updated, so the consent command can say so.
let ignoreFailed = false

/**
 * Renames, retrying for a moment on Windows, where an antivirus or indexer holding the target open
 * makes a rename fail with EPERM, EACCES or EBUSY.
 */
function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      return renameSync(from, to)
    } catch (err) {
      if (platform() !== 'win32' || attempt >= 10 || !['EPERM', 'EACCES', 'EBUSY'].includes(err.code)) throw err
      sleepSync(50)
    }
  }
}

// Only called inside updateLedger, under the ledger lock. Written to a temporary file and renamed,
// so a crash never leaves a half-written ledger; the temporary file is removed if the write fails.
function writeLedger(root, ledger) {
  const path = join(root, LEDGER_FILE)
  const temporary = `${path}.${process.pid}.tmp`
  try {
    writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`)
    renameWithRetry(temporary, path)
  } catch (err) {
    try {
      unlinkSync(temporary)
    } catch {}
    throw err
  }
}

function getConsent(ledger) {
  if (isDisabledByEnv()) return 'denied'
  return ledger?.consent === 'granted' || ledger?.consent === 'denied' ? ledger.consent : 'unknown'
}

// ---------------------------------------------------------------------------------------------
// Locks
// ---------------------------------------------------------------------------------------------

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err.code === 'EPERM'
  }
}

/**
 * Whether a lock's holder is gone: its process is not running, the lock is older than `staleMs` or
 * dated well in the future, or it is not a lock record (empty or partial after a crash or a full
 * disk) and its file is a couple of seconds old or dated in the future.
 */
export function isStale(path, content, staleMs) {
  let holder
  try {
    holder = JSON.parse(content)
  } catch {}
  if (isPlainObject(holder) && Number.isInteger(holder.pid) && Number.isFinite(holder.at)) {
    const age = Date.now() - holder.at
    return !isAlive(holder.pid) || age > staleMs || age < -LOCK_CLOCK_SKEW_MS
  }
  let mtimeMs
  try {
    mtimeMs = statSync(path).mtimeMs
  } catch (err) {
    // Released between the read and now: gone, so as good as stale; the caller tries to take it.
    if (err.code === 'ENOENT') return true
    throw err
  }
  const age = Date.now() - mtimeMs
  return age > Math.min(staleMs, UNREADABLE_LOCK_STALE_MS) || age < -LOCK_CLOCK_SKEW_MS
}

/** Whether creating a file failed because another process holds it. */
function isBusy(err, path) {
  if (err.code === 'EEXIST') return true
  // On Windows, a lock file being deleted while another process has it open refuses new creates
  // with EPERM until it is gone.
  return platform() === 'win32' && (err.code === 'EPERM' || err.code === 'EACCES') && existsSync(path)
}

/**
 * Takes a lock file, or returns undefined if another live process holds it. Any other error (a
 * read-only folder, a full disk) is thrown, not mistaken for "busy".
 *
 * The file holds an owner token, the pid and the time. A stale lock is taken over by one process at
 * a time: it first creates a takeover marker next to the lock, then reads the lock again and, only if
 * it is still the same stale one, moves it aside and creates its own. With the marker held, only a
 * live holder releasing its lock can change it, so a lock someone else took meanwhile is never moved.
 * The returned release also has `holds()`, to check the lock is still this owner's before a write. No hard links are used, so it works on every file
 * system (exFAT and FAT32 have none). The returned release only removes
 * the file if it still holds this owner's token.
 */
function tryLock(path, staleMs) {
  const token = randomUUID()
  const content = JSON.stringify({ token, pid: process.pid, at: Date.now() })
  const take = () => {
    try {
      writeFileSync(path, content, { flag: 'wx' })
      return true
    } catch (err) {
      if (isBusy(err, path)) return false
      throw err
    }
  }
  const holds = () => {
    try {
      return JSON.parse(readFileSync(path, 'utf8')).token === token
    } catch {
      return false
    }
  }
  const release = () => {
    try {
      if (holds()) unlinkSync(path)
    } catch {}
  }
  release.holds = holds
  if (take()) return release
  if (!takeOverIfStale(path, staleMs)) return undefined
  return take() ? release : undefined
}

/**
 * Removes a stale lock, serialised through a takeover marker. Returns whether it was removed.
 *
 * @param observed The lock's content as the caller read it; read here when not given
 */
export function takeOverIfStale(path, staleMs, observed) {
  const read = () => {
    try {
      return readFileSync(path, 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') return undefined
      throw err
    }
  }
  observed ??= read()
  if (observed === undefined) return true
  if (!isStale(path, observed, staleMs)) return false
  const marker = `${path}.takeover`
  try {
    writeFileSync(marker, String(process.pid), { flag: 'wx' })
  } catch (err) {
    if (!isBusy(err, marker)) throw err
    // A marker left by a process that died mid-takeover is removed; the caller tries again later.
    try {
      const age = Date.now() - statSync(marker).mtimeMs
      if (age > TAKEOVER_STALE_MS || age < -LOCK_CLOCK_SKEW_MS) unlinkSync(marker)
    } catch {}
    return false
  }
  try {
    // Read again under the marker: another process may have taken the stale lock over, and a new
    // holder created a fresh one, since it was first read.
    const current = read()
    if (current === undefined) return true
    if (current !== observed || !isStale(path, current, staleMs)) return false
    // Moved aside rather than removed, so a lock its live holder released, and someone else took,
    // between that read and the move is put back instead of lost.
    const aside = `${marker}.${randomUUID()}`
    try {
      renameSync(path, aside)
    } catch (err) {
      if (err.code === 'ENOENT') return true
      throw err
    }
    const moved = readFileSync(aside, 'utf8')
    if (moved === current && isStale(aside, moved, staleMs)) {
      unlinkSync(aside)
      return true
    }
    // Restored with its content, so its holder's release still recognises it. If yet another
    // process created the lock meanwhile, the restore fails; the holder whose lock was moved finds
    // out through holds() before it writes (see updateLedger).
    try {
      writeFileSync(path, moved, { flag: 'wx' })
    } catch {}
    unlinkSync(aside)
    return false
  } finally {
    try {
      unlinkSync(marker)
    } catch {}
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Reads, changes and writes the ledger under a short per-scene lock, so a submit and a background run
 * never overwrite each other's changes. The lock is held only around the file work, never during a
 * network call.
 *
 * @param mutate Receives the current ledger (or null) and returns the ledger to write, or null
 */
export function updateLedger(root, mutate) {
  const path = join(root, LEDGER_LOCK_FILE)
  for (let attempt = 1; ; attempt++) {
    // Each attempt gets the full wait, so a retry that finds the lock busy does not give up at once.
    const deadline = Date.now() + LEDGER_LOCK_WAIT_MS
    let release = tryLock(path, LEDGER_LOCK_STALE_MS)
    while (!release) {
      if (Date.now() > deadline) throw new Error("the scene's report ledger is locked by another run")
      sleepSync(20)
      release = tryLock(path, LEDGER_LOCK_STALE_MS)
    }
    try {
      // Under the lock, so concurrent first runs add the ignore line once.
      ensureIgnored(root)
      const next = mutate(readLedger(root))
      // A lock taken over while this run held it (it overran the stale time) is no longer this
      // run's: writing now could overwrite the new holder's change, so start over instead.
      if (!release.holds()) {
        if (attempt < LEDGER_ATTEMPTS) continue
        throw new Error("lost the scene's report ledger lock to another run")
      }
      if (next) writeLedger(root, next)
      return next
    } catch (err) {
      // A file system hiccup (a file vanishing or busy for a moment) gets another try, so the report
      // being queued is not lost.
      if (attempt < LEDGER_ATTEMPTS && typeof err.code === 'string') continue
      throw err
    } finally {
      release()
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The ways a path shows up in text: as is, with forward slashes, JSON-escaped, as Git Bash, Cygwin
 * and WSL write a Windows drive (`/c/Users/...`), and URL-encoded. Longest first.
 */
function pathSpellings(path) {
  if (!path || path.length < 2) return []
  const spellings = new Set([
    path,
    path.replace(/\\/g, '/'),
    path.replace(/\\/g, '\\\\'),
    path.replace(/\\/g, '\\\\\\\\')
  ])
  const drive = /^([A-Za-z]):[\\/](.*)$/.exec(path)
  if (drive) {
    const rest = drive[2].replace(/\\/g, '/')
    const letter = drive[1].toLowerCase()
    for (const prefix of ['', '/cygdrive', '/mnt']) spellings.add(`${prefix}/${letter}/${rest}`)
  }
  for (const spelling of [...spellings]) {
    try {
      spellings.add(encodeURI(spelling))
      spellings.add(encodeURIComponent(spelling))
    } catch {}
  }
  return [...spellings].filter(spelling => spelling.length > 1).sort((a, b) => b.length - a.length)
}

/**
 * Strips what must never leave the machine: this scene's path and the home directory, then the
 * reporting service's own redaction. The agent is told not to include any of this; this is the
 * safety net for when it does. The service applies the same redaction again.
 */
export function redact(text, root) {
  if (!text) return text
  let result = text
  const home = homedir()
  for (const [path, placeholder] of [
    [root, '<SCENE>'],
    [home, '~']
  ]) {
    // A path directly under /Users, /home or C:\Users ends in a user name, which may be the first
    // word of a name with a space (`/home/bob smith/`): that is left to the username rule rather
    // than turned into `~ smith/`. Nothing else is skipped, so a scene path goes wherever it ends.
    const userHome = /[\\/](?:Users|home)[\\/][^\\/]+[\\/]?$/i.test(path)
    const nameGoesOn = userHome ? '| [^/\\\\\\s]{1,40}[/\\\\]' : ''
    for (const variant of pathSpellings(path)) {
      // Case-insensitive (Windows and macOS paths are), and only where the path ends, so a home of
      // /home/al leaves /home/alice to the username rule rather than turning it into ~ice.
      const pattern = new RegExp(`${escapeRegExp(variant)}(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}]${nameGoesOn})`, 'giu')
      result = result.replace(pattern, placeholder)
    }
  }
  return redactText(result)
}

export function validate(input) {
  const errors = []
  if (!isPlainObject(input)) return ['the report must be a JSON object']
  for (const key of Object.keys(input)) {
    if (!INPUT_FIELDS.includes(key)) errors.push(`unknown field "${key}"`)
  }
  for (const key of ['title', 'description', 'kind', 'fingerprint']) {
    if (typeof input[key] !== 'string' || input[key].trim() === '') errors.push(`"${key}" is required`)
  }
  for (const key of ['workaround', 'skill', 'agent']) {
    if (input[key] !== undefined && typeof input[key] !== 'string') errors.push(`"${key}" must be a string`)
  }
  for (const [key, max] of Object.entries(LIMITS)) {
    if (typeof input[key] === 'string' && input[key].length > max) errors.push(`"${key}" is longer than ${max} characters`)
  }
  if (typeof input.kind === 'string' && !KINDS.includes(input.kind)) errors.push(`"kind" must be one of ${KINDS.join(', ')}`)
  if (typeof input.fingerprint === 'string' && !SLUG.test(input.fingerprint))
    errors.push('"fingerprint" must be a lowercase kebab-case slug, e.g. ui-input-controlled-reset')
  else if (typeof input.fingerprint === 'string' && carriesSecret(input.fingerprint))
    errors.push('"fingerprint" looks like a key, hash or seed phrase; describe the area and symptom instead')
  if (typeof input.skill === 'string' && input.skill !== '' && !SLUG.test(input.skill))
    errors.push('"skill" must be a skill name, e.g. build-ui')
  else if (typeof input.skill === 'string' && carriesSecret(input.skill)) errors.push('"skill" looks like a key, hash or seed phrase')
  return errors
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** A version or range from the registry; anything else (a file: path, a URL, a tarball) is left out. */
const VERSION_LIKE = /^[\w.^~<>=|* -]{1,40}$/

function detectSdkVersion(root) {
  const installed = readJson(join(root, 'node_modules', '@dcl', 'sdk', 'package.json'))
  const manifest = readJson(join(root, 'package.json'))
  const version =
    installed?.version || manifest?.dependencies?.['@dcl/sdk'] || manifest?.devDependencies?.['@dcl/sdk']
  return typeof version === 'string' && VERSION_LIKE.test(version) ? version : undefined
}

/** Cuts a string to `max` characters, marking the cut and never splitting a surrogate pair. */
function cut(text, max) {
  if (text.length <= max) return text
  let end = Math.max(0, max - 1)
  const last = text.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff) end--
  return `${text.slice(0, end)}…`
}

function payloadBytes(payload) {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8')
}

/**
 * Builds the payload: redacted text fitted to the service's field limits (redaction can lengthen
 * text) and the whole body fitted under its 32 KB limit (multi-byte text can be far larger in bytes
 * than in characters), so a valid report is never refused, and lost, for its size.
 */
function buildPayload(input, root) {
  const payload = {
    clientReportId: randomUUID(),
    title: input.title.trim(),
    description: input.description.trim(),
    kind: input.kind,
    fingerprint: input.fingerprint
  }
  if (input.workaround?.trim()) payload.workaround = input.workaround.trim()
  if (input.skill) payload.skill = input.skill
  const sdkVersion = detectSdkVersion(root)
  if (sdkVersion) payload.sdkVersion = sdkVersion
  payload.metadata = { os: platform(), node: process.versions.node }
  if (input.agent) payload.metadata.agent = input.agent
  return sanitizePayload(payload, root)
}

/**
 * Makes a payload safe and acceptable: redacts its text, keeps only known fields and a version-like
 * sdkVersion, cuts each field to its limit and the body under MAX_PAYLOAD_BYTES. Run when a report is
 * queued and again before it is sent, so reports queued by an earlier version of this script get
 * today's protections. Redaction is idempotent, so running it twice changes nothing.
 *
 * @returns The payload, or null if its fingerprint or skill is no longer acceptable
 */
function sanitizePayload(stored, root) {
  if (!isPlainObject(stored) || typeof stored.clientReportId !== 'string') return null
  const text = (value, max) => (typeof value === 'string' && value.trim() ? cut(redact(value.trim(), root), max) : undefined)
  const payload = {
    clientReportId: stored.clientReportId,
    title: text(stored.title, LIMITS.title),
    description: text(stored.description, LIMITS.description),
    kind: stored.kind,
    fingerprint: stored.fingerprint
  }
  if (!payload.title || !payload.description || !KINDS.includes(payload.kind)) return null
  if (
    typeof payload.fingerprint !== 'string' ||
    payload.fingerprint.length > LIMITS.fingerprint ||
    !SLUG.test(payload.fingerprint) ||
    carriesSecret(payload.fingerprint)
  )
    return null
  const workaround = text(stored.workaround, LIMITS.workaround)
  if (workaround) payload.workaround = workaround
  if (typeof stored.skill === 'string' && stored.skill !== '') {
    if (!SLUG.test(stored.skill) || carriesSecret(stored.skill) || stored.skill.length > LIMITS.skill) return null
    payload.skill = stored.skill
  }
  if (typeof stored.sdkVersion === 'string' && VERSION_LIKE.test(stored.sdkVersion)) payload.sdkVersion = stored.sdkVersion
  const metadata = isPlainObject(stored.metadata) ? stored.metadata : {}
  payload.metadata = {}
  for (const key of ['os', 'node']) {
    if (typeof metadata[key] === 'string' && /^[\w.-]{1,40}$/.test(metadata[key])) payload.metadata[key] = metadata[key]
  }
  const agent = text(metadata.agent, LIMITS.agent)
  if (agent) payload.metadata.agent = agent
  // A character takes at most 6 bytes in the JSON body (a \u escape), so cutting excess / 6
  // characters a round always makes progress without cutting more than needed. The description
  // goes first: it is the longest, and the workaround is the part a reader acts on.
  for (const field of ['description', 'workaround']) {
    while (payload[field] && payloadBytes(payload) > MAX_PAYLOAD_BYTES) {
      const excess = payloadBytes(payload) - MAX_PAYLOAD_BYTES
      const next = payload[field].length - Math.max(16, Math.ceil(excess / 6))
      if (next < 2) {
        if (field === 'workaround') delete payload.workaround
        else payload.description = '…'
        break
      }
      payload[field] = cut(payload[field], next)
    }
  }
  return payload
}

/** A Retry-After header in seconds or as an HTTP date, held to sensible bounds. */
function parseRetryAfter(value) {
  if (!value) return undefined
  const seconds = Number(value)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now()
  if (!Number.isFinite(ms)) return undefined
  return Math.min(MAX_BACKOFF_MS, Math.max(MIN_BACKOFF_MS, ms))
}

// 4xx answers that a proxy, firewall or wrong URL gives rather than the service, or that ask to wait.
const NOT_THE_SERVICE = [401, 403, 404, 405, 407, 408, 429]
// 5xx answers that mean the service is unavailable or a gateway in front of it failed (Cloudflare's
// 52x), not that it failed on this report.
const GATEWAY_ERRORS = [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]

/**
 * Sends one report and classifies the answer:
 * - `sent`: a 200 or 201 with the service's JSON body (an issue number). Nothing else counts, so a
 *   captive portal, proxy login page or redirect never marks a report sent.
 * - `rejected`: any other 4xx (the service uses 400, 413 and 422 for a payload it will never accept).
 * - `pending` with `transport: true`: the service could not be reached or asked to wait (network
 *   errors, timeouts, 3xx, 408, 429, 502, 503, 504, Cloudflare's 52x, and the 401/403/404/405/407 a
 *   proxy or firewall gives).
 *   The run stops and backs off.
 * - `pending` otherwise: another 5xx, which may be this report's problem. The run moves on to the
 *   next report.
 */
async function send(endpoint, payload) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: controller.signal
    })
    const text = await response.text().catch(() => '')
    let body
    try {
      body = JSON.parse(text)
    } catch {}
    const status = response.status
    if ((status === 200 || status === 201) && isPlainObject(body) && Number.isInteger(body.issueNumber)) {
      return { outcome: 'sent', issueNumber: body.issueNumber }
    }
    if (status >= 400 && status < 500 && !NOT_THE_SERVICE.includes(status)) {
      const reason = isPlainObject(body) && typeof body.error === 'string' ? `: ${cut(body.error, 200)}` : ''
      return { outcome: 'rejected', error: `HTTP ${status}${reason}` }
    }
    // Everything below 500 that is left (a 2xx without the service's answer, a 3xx, the 4xx above)
    // and a gateway error mean the service was not reached or asked to wait.
    const transport = status < 500 || GATEWAY_ERRORS.includes(status)
    return {
      outcome: 'pending',
      transport,
      error: status >= 200 && status < 300 ? `HTTP ${status} without the service's answer` : `HTTP ${status}`,
      retryAfterMs: parseRetryAfter(response.headers.get('retry-after'))
    }
  } catch (err) {
    return { outcome: 'pending', transport: true, error: err.name === 'AbortError' ? 'timeout' : err.message }
  } finally {
    clearTimeout(timer)
  }
}

function applyResult(entry, result) {
  const now = Date.now()
  entry.lastAttemptAt = new Date(now).toISOString()
  // Counted from the first try, not from when it was queued: reports queued before the endpoint
  // existed may be months old when they are first sent.
  entry.firstAttemptAt ??= entry.lastAttemptAt
  if (result.outcome === 'pending') {
    entry.lastError = result.error
    if (!result.transport) {
      entry.failures = (entry.failures || 0) + 1
      entry.nextAttemptAt = new Date(now + RETRY_DELAYS_MS[Math.min(entry.failures, RETRY_DELAYS_MS.length) - 1]).toISOString()
      if (entry.failures >= MAX_ATTEMPTS) result = { outcome: 'failed', error: `gave up after ${entry.failures} failures (${result.error})` }
    } else if (now - Date.parse(entry.firstAttemptAt) > MAX_PENDING_AGE_MS) {
      result = { outcome: 'failed', error: `gave up after ${MAX_PENDING_AGE_MS / 86_400_000} days unsent (${result.error})` }
    }
  }
  entry.status = result.outcome
  if (result.outcome === 'pending') return
  // Once final, the payload has no further use; keeping only the summary keeps the file small.
  delete entry.payload
  delete entry.lastError
  delete entry.nextAttemptAt
  if (result.issueNumber !== undefined) entry.issueNumber = result.issueNumber
  if (result.error) entry.error = result.error
}

function isInBackoff(ledger) {
  const until = Date.parse(ledger?.backoffUntil)
  // A date further out than any backoff this script sets (after a clock correction, say) is ignored.
  return Number.isFinite(until) && until > Date.now() && until - Date.now() <= MAX_BACKOFF_MS
}

/** Whether a queued report's retry delay, after the service failed on it, has passed. */
function isDue(entry) {
  const at = Date.parse(entry.nextAttemptAt)
  return !Number.isFinite(at) || at <= Date.now() || at - Date.now() > RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
}

function queued(ledger) {
  return ledger.reports.filter(entry => entry.status === 'pending' && entry.payload)
}

function hasQueuedWork(ledger) {
  return Boolean(getEndpoint()) && getConsent(ledger) === 'granted' && !isInBackoff(ledger) && queued(ledger).some(isDue)
}

/**
 * Starts a detached process that sends the queued reports, and returns at once. If it cannot be
 * started, the reports simply stay queued for the next run.
 */
function startBackgroundFlush(root) {
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'flush', '--background', '--dir', root], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: process.env
    })
    child.on('error', () => {})
    child.unref()
  } catch {}
}

/**
 * Sends queued reports, least recently tried first, until none is left. One run per scene at a time;
 * each result is written back under the ledger lock, so a report queued meanwhile is kept.
 *
 * A transport failure (see send) stops the run and puts background runs in backoff until Retry-After,
 * or DEFAULT_BACKOFF_MS. Another 5xx counts against that report only and the run moves on, unless
 * two in a row fail that way, which means the service is down and also backs off. A report is
 * given up on after MAX_ATTEMPTS. A run started by hand ignores the backoff. When a background run
 * finishes and a report was queued while it was finishing, it starts another run for it.
 */
async function flush(root, options = {}) {
  if (!existsSync(join(root, LEDGER_FILE))) return 'flushed\nNothing is queued.'
  const release = tryLock(join(root, SEND_LOCK_FILE), SEND_LOCK_STALE_MS)
  if (!release) return "busy\nAnother run is already sending this scene's queued reports."
  const counts = { sent: 0, rejected: 0, failed: 0, pending: 0 }
  const tried = new Set()
  let stoppedForBackoff = false
  try {
    let consecutiveFailures = 0
    for (let sends = 0; sends < MAX_SENDS_PER_RUN; sends++) {
      const ledger = readLedger(root)
      if (!ledger || !getEndpoint() || getConsent(ledger) !== 'granted') break
      if (options.background && isInBackoff(ledger)) break
      // A run started by hand also retries reports still waiting out their retry delay.
      const entry = queued(ledger)
        .filter(candidate => !tried.has(candidate.clientReportId) && (!options.background || isDue(candidate)))
        .sort((a, b) => Date.parse(a.lastAttemptAt || a.createdAt) - Date.parse(b.lastAttemptAt || b.createdAt))[0]
      if (!entry) break
      tried.add(entry.clientReportId)
      const payload = sanitizePayload(entry.payload, root)
      const result = payload
        ? await send(getEndpoint(), payload)
        : { outcome: 'rejected', error: 'the stored report is not one this version can send' }
      if (result.outcome === 'pending') consecutiveFailures++
      else if (payload) consecutiveFailures = 0
      const backOff = result.outcome === 'pending' && (result.transport || consecutiveFailures >= 2)
      updateLedger(root, current => {
        if (!current) return null
        const target = current.reports.find(candidate => candidate.clientReportId === entry.clientReportId)
        if (target) applyResult(target, result)
        if (backOff) current.backoffUntil = new Date(Date.now() + (result.retryAfterMs ?? DEFAULT_BACKOFF_MS)).toISOString()
        else if (result.outcome === 'sent') delete current.backoffUntil
        return current
      })
      const final = readLedger(root)?.reports.find(candidate => candidate.clientReportId === entry.clientReportId)
      counts[final?.status in counts ? final.status : 'pending']++
      if (backOff) {
        stoppedForBackoff = true
        break
      }
    }
  } finally {
    release()
  }
  const ledger = readLedger(root)
  if (options.background && !stoppedForBackoff && ledger && hasQueuedWork(ledger)) {
    if (queued(ledger).some(entry => !tried.has(entry.clientReportId) && isDue(entry))) startBackgroundFlush(root)
  }
  const left = ledger ? queued(ledger).length : 0
  return `flushed\n${counts.sent} sent, ${counts.rejected} rejected, ${counts.failed} given up, ${left} still queued.`
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

/** Reads a report file, accepting a UTF-8 BOM and UTF-16 (what Windows PowerShell 5.1 writes). */
function readReportFile(path) {
  return decodeText(readFileSync(path))
}

/**
 * Decodes text from a file or pipe: UTF-8 (with or without a BOM), UTF-16 with a BOM (what Windows
 * PowerShell 5.1 and cmd write), and, when the bytes are not valid UTF-8, Windows-1252 (the ANSI
 * default of Set-Content) instead of replacing every accented letter.
 */
function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le')
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swapped = Buffer.from(bytes.subarray(2))
    swapped.swap16()
    return swapped.toString('utf16le')
  }
  const body = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  } catch {
    // Mapped by hand: some Node versions decode 0x80-0x9F as invisible control characters instead
    // of the euro sign, curly quotes and dashes Windows puts there.
    return Array.from(body, byte => (byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : String.fromCharCode(byte))).join('')
  }
}

/** Windows-1252 characters for bytes 0x80 to 0x9F; the rest of the code page matches Latin-1. */
const CP1252_HIGH = [
  '\u20ac', '\u0081', '\u201a', '\u0192', '\u201e', '\u2026', '\u2020', '\u2021',
  '\u02c6', '\u2030', '\u0160', '\u2039', '\u0152', '\u008d', '\u017d', '\u008f',
  '\u0090', '\u2018', '\u2019', '\u201c', '\u201d', '\u2022', '\u2013', '\u2014',
  '\u02dc', '\u2122', '\u0161', '\u203a', '\u0153', '\u009d', '\u017e', '\u0178'
]

/**
 * Reads the report from stdin, within one overall deadline, and then stops reading so an open but
 * silent pipe cannot keep the process alive.
 */
function readStdin() {
  return new Promise((resolvePromise, reject) => {
    if (process.stdin.isTTY) return reject(new UsageError('Pipe the report JSON into stdin, or pass --file'))
    const chunks = []
    let settled = false
    const settle = (action, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      process.stdin.removeAllListeners('data')
      process.stdin.pause()
      process.stdin.destroy()
      action(value)
    }
    const timer = setTimeout(
      () => settle(reject, new UsageError('The report JSON on stdin did not finish arriving. Pipe it in, or pass --file')),
      STDIN_TIMEOUT_MS
    )
    process.stdin.on('data', chunk => chunks.push(chunk))
    process.stdin.on('end', () => settle(resolvePromise, decodeText(Buffer.concat(chunks))))
    process.stdin.on('error', err => settle(reject, err))
  })
}

function consentLine(consent) {
  if (consent === 'unknown')
    return 'consent:unknown\nAsk the user once whether SDK issue reports may be sent, then run: report.mjs consent --grant (or --deny)'
  return isDisabledByEnv()
    ? 'consent:denied\nReporting is disabled by DCL_SDK_ISSUE_REPORTS. Do not ask; apply the workaround.'
    : 'consent:denied\nThe user declined SDK issue reports for this scene. Do not ask again; apply the workaround.'
}

/** Reports that settle a fingerprint: queued, sent or still being retried. Rejected or given-up ones do not. */
function settles(entry) {
  return entry.status === 'pending' || entry.status === 'sent'
}

async function check(root, options) {
  if (!options.fingerprint) throw new UsageError('check needs --fingerprint <slug>')
  if (!SLUG.test(options.fingerprint)) throw new UsageError('--fingerprint must be a lowercase kebab-case slug')
  const ledger = readLedger(root)
  const consent = getConsent(ledger)
  if (consent !== 'granted') return consentLine(consent)
  if (hasQueuedWork(ledger)) startBackgroundFlush(root)
  const known = ledger.reports.find(entry => entry.fingerprint === options.fingerprint && settles(entry))
  return known ? `reported\nAlready reported from this scene (${known.status}). Apply the workaround.` : 'not-reported'
}

function consent(root, options) {
  if (options.grant === options.deny) throw new UsageError('consent needs exactly one of --grant or --deny')
  const ledger = updateLedger(root, current => {
    const next = current || { reports: [] }
    next.consent = options.grant ? 'granted' : 'denied'
    next.consentAt = new Date().toISOString()
    return next
  })
  let note = isDisabledByEnv() ? '\nNote: DCL_SDK_ISSUE_REPORTS disables reporting on this machine regardless.' : ''
  if (ignoreFailed) note += `\nNote: could not add ${IGNORE_ENTRY} to .gitignore or .dclignore; add it by hand so the report ledger is never committed or deployed.`
  return `consent:${ledger.consent}${note}`
}

async function submit(root, options) {
  const ledger = readLedger(root)
  const consentState = getConsent(ledger)
  if (consentState !== 'granted') return consentLine(consentState)

  const raw = options.file ? readReportFile(options.file) : await readStdin()
  let input
  try {
    input = JSON.parse(raw)
  } catch {
    throw new UsageError('invalid: the report is not valid JSON')
  }
  const errors = validate(input)
  if (errors.length > 0) throw new UsageError(`invalid: ${errors.join('; ')}`)

  const payload = buildPayload(input, root)
  if (!payload) throw new UsageError('invalid: the report has nothing left to send after redaction')
  let known
  updateLedger(root, current => {
    // A copy, so a retry (see updateLedger) does not find this attempt's entry already in it.
    const latest = current || { ...ledger, reports: [...ledger.reports] }
    known = latest.reports.find(entry => entry.fingerprint === input.fingerprint && settles(entry))
    if (known) return null
    // Queued first and sent by a background process, so the agent never waits on the network.
    latest.reports.push({
      clientReportId: payload.clientReportId,
      fingerprint: payload.fingerprint,
      title: payload.title,
      status: 'pending',
      createdAt: new Date().toISOString(),
      payload
    })
    return latest
  })
  if (known) return `already-reported\nThis issue was already reported from this scene (${known.status}).`

  if (!getEndpoint()) return 'queued\nSaved locally; sending is turned off on this machine (DCL_SDK_ISSUE_REPORTS_URL).'
  startBackgroundFlush(root)
  return 'queued\nSaved; it is being sent to the Decentraland SDK team in the background.'
}

function status(root) {
  const ledger = readLedger(root)
  const counts = { pending: 0, sent: 0, rejected: 0, failed: 0 }
  for (const entry of ledger?.reports || []) counts[entry.status] = (counts[entry.status] || 0) + 1
  return [
    `consent:${getConsent(ledger)}`,
    `scene: ${root}`,
    `endpoint: ${getEndpoint() || 'off (DCL_SDK_ISSUE_REPORTS_URL is none, off, empty or not an https URL)'}`,
    `reports: ${counts.sent} sent, ${counts.pending} pending, ${counts.rejected} rejected, ${counts.failed} given up`,
    ...(isInBackoff(ledger) ? [`backing off until ${ledger.backoffUntil}`] : [])
  ].join('\n')
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2))
  const root = options.dir ? realPath(options.dir) : findSceneRoot(process.cwd())
  switch (command) {
    case 'check':
      return check(root, options)
    case 'consent':
      return consent(root, options)
    case 'submit':
      return submit(root, options)
    case 'flush':
      return flush(root, options)
    case 'status':
      return status(root)
    default:
      throw new UsageError('Usage: report.mjs check --fingerprint <slug> | consent --grant|--deny | submit [--file f] | flush | status')
  }
}

// Compared by real path: skills are installed as symlinks (npx skills add), and Node reports this
// module's real path while argv[1] keeps the symlinked one.
const isEntryPoint = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
})()

if (isEntryPoint) {
  main().then(
    output => {
      console.log(output)
      process.exit(0)
    },
    err => {
      console.log(err instanceof UsageError ? err.message : `error: ${err.message}`)
      process.exit(err instanceof UsageError ? 2 : 1)
    }
  )
}
