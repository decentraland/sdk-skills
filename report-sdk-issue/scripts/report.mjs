#!/usr/bin/env node
// Report Decentraland SDK bugs and limitations to the SDK team, once per issue, with the user's consent.
//
// Consent and the ledger of what was already reported live in <scene root>/.dcl-sdk-reports.json.
// That file is added to .gitignore and .dclignore on first write, so it is never committed or deployed.
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
// service costs the user no time. After a 429 or 503, background runs back off until Retry-After.
//
// Every change to the ledger happens under a short per-scene lock, never held across a network
// call, so a submit and a background run cannot overwrite each other. Lock files live in
// ~/.cache/dcl-sdk-reports, per user.
//
// Options:
//   --dir DIR   scene folder (default: nearest parent of the cwd containing scene.json, else the cwd)
//
// Environment:
//   DCL_SDK_ISSUE_REPORTS=off         disables reporting everywhere (wins over a granted consent)
//   DCL_SDK_ISSUE_REPORTS_URL=<url>   overrides the reporting endpoint (base URL; /reports is appended)
//
// The first line of output is always the machine-readable result; anything after it is for humans.
// Exit codes: 0 for every result above, 2 for invalid input or usage, 1 for unexpected errors.
//
// Requires Node >= 18 (global fetch). No dependencies.

import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, linkSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The reporting service is not live yet. While this is null, reports are validated and queued in
// the ledger as pending; they are sent on the first run after this constant gets a URL.
const DEFAULT_ENDPOINT = null

const LEDGER_FILE = '.dcl-sdk-reports.json'
const IGNORE_FILES = ['.gitignore', '.dclignore']
// The service gives each report up to 20 seconds of GitHub calls; waiting longer than that keeps
// the script from giving up, and later resending, a report the service is still filing.
const REQUEST_TIMEOUT_MS = 30000
// How many queued reports one background run sends. It stops early at the first one that still
// fails, since the rest would fail the same way.
const MAX_FLUSH_PER_RUN = 5
// Locks live in a per-user folder, never a shared temp folder another user could pre-empt.
const LOCK_DIR = join(homedir(), '.cache', 'dcl-sdk-reports')
// A send lock older than a full background run (MAX_FLUSH_PER_RUN request timeouts) belongs to a
// run that died. A ledger lock is only held around a file read and write, so seconds is plenty.
const SEND_LOCK_STALE_MS = 5 * 60_000
const LEDGER_LOCK_STALE_MS = 30_000
const LEDGER_LOCK_WAIT_MS = 5_000
// A lock file is written right after it is created, so one that still cannot be parsed after this
// long was left empty or partial by a process that died or a full disk, and is stale.
const UNREADABLE_LOCK_STALE_MS = 2_000
// How long background runs leave the service alone after it answers 429 or 503 without a
// Retry-After, or cannot be reached at all.
const DEFAULT_BACKOFF_MS = 10 * 60_000

const KINDS = ['bug', 'limitation', 'docs-gap']
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
// Whether a slug carries a secret rather than words. Slugs reach the issue footer and labels,
// where the service does not redact, so this refuses 32+ hex characters across the hex-only
// segments (a key split up, even by a word) and more than 10 segments (a seed phrase as a slug).
// The service applies the same rule.
const MAX_SLUG_SEGMENTS = 10
function carriesSecret(slug) {
  const segments = slug.split('-')
  const hexLength = segments
    .map(segment => segment.replace(/^0x/, ''))
    .filter(segment => /^[0-9a-f]+$/.test(segment))
    .reduce((total, segment) => total + segment.length, 0)
  return hexLength >= 32 || segments.length > MAX_SLUG_SEGMENTS
}
// Kept in step with the reporting service's redaction (workers/sdk-issue-reports in
// ops/cloudflare-workers, src/logic/redaction/component.ts).
/**
 * Field names whose value is a credential. Matched as the end of a name (`apiKey`, `GITHUB_TOKEN`,
 * `db-password`), never as a fragment of a longer word, so `Tokenizer` and `author` are left alone.
 */
const SECRET_KEYWORD =
  '(?:api[_-]?key|private[_-]?key|access[_-]?key|secret[_-]?key|client[_-]?secret|secret|token|passw(?:or)?d|passphrase|mnemonic|seed[_-]?phrase|credentials?)'

/**
 * A credential field name: at most 40 name characters, then a keyword, starting where a name can
 * start. Both bounds matter. An unbounded `[\w-]*` before and after the keyword backtracks
 * polynomially on input like `auth-auth-auth-…` (seconds of CPU per request on a public
 * endpoint); a bounded, anchored prefix keeps every pattern here linear in the input.
 */
const SECRET_NAME = `(?<![\\w-])[\\w-]{0,40}?${SECRET_KEYWORD}(?![\\w-])`

/** An optional TypeScript annotation between a name and its value: `password: string = '…'`. */
const TYPE_ANNOTATION = '(?::\\s*[A-Za-z_][\\w.<>\\[\\]| ]{0,40}?\\s*)?'

/** Type names that follow `name:` in TypeScript annotations; not values, so left alone. */
const TYPE_NAMES = '(?:string|number|boolean|undefined|null|any|unknown|true|false)(?![\\w-])'

/** A quoted string with escapes, in single, double or back quotes; the `q` group is the quote. */
const QUOTED = '(?<q>[\'"`])(?:\\\\.|(?!\\k<q>)[^\\\\\\n])*\\k<q>'

/** Hex runs are bounded by non-hex characters, not word boundaries, so `KEY_<hex>` is caught too. */
const NOT_HEX_BEFORE = '(?<![0-9a-fA-F])'
const NOT_HEX_AFTER = '(?![0-9a-fA-F])'

/**
 * Upper-case environment names with a credential word anywhere in them (`AWS_ACCESS_KEY_ID`,
 * `GITHUB_TOKEN_V2`, `SECRET_KEY_BASE`, `AUTH`, `SEED`). Case-sensitive, so it only reads names
 * written the way environment variables are, and never `author` or `seedling` in prose or code.
 */
const ENV_NAME =
  '(?<![\\w-])[A-Z0-9_]{0,40}?(?:TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|MNEMONIC|SEED|CREDENTIALS?|AUTH|API_KEY|ACCESS_KEY|PRIVATE_KEY|_KEY)[A-Z0-9_]{0,40}(?![\\w-])'

/**
 * camelCase names with a credential word followed by more words (`tokenValue`, `authHeader`,
 * `userSecretHash`). Case-sensitive: the word after the credential word must start upper-case,
 * which is what tells `tokenValue` apart from `Tokenizer` or `author`.
 */
const CAMEL_NAME =
  '(?<![\\w-])(?:[a-z][A-Za-z0-9]{0,40}?)?(?:token|Token|secret|Secret|password|Password|passphrase|Passphrase|auth|Auth|apiKey|ApiKey|accessKey|AccessKey|privateKey|PrivateKey|credentials?|Credentials?)[A-Z][A-Za-z0-9]{0,20}(?![\\w-])'

/** A bare value: not quoted, not already a placeholder, not a type name or boolean. */
const BARE_VALUE = `(?![\\s'"\`<]|${TYPE_NAMES})[^\\s,;'"\`&)}\\]]+`


/** Redacts the token after `Authorization:`, keeping a scheme word (`Bearer`, `Token`, …) if any. */
function redactAuthorization(_match, prefix, scheme) {
  return `${prefix}${scheme ? `${scheme} ` : ''}<TOKEN>`
}

/**
 * What is replaced, in order. Order matters: bearer and basic credentials go before field names,
 * so `Authorization: Bearer <token>` keeps its scheme and loses its token.
 *
 * Every pattern either starts at a fixed literal or is anchored by a lookbehind to where a token
 * can start, and every repetition next to an alternation is bounded, so redaction time stays
 * linear in the input. The redaction tests hold each one to a time budget on adversarial input.
 */
const REDACTIONS = [
  // Home directories, where a filesystem path starts; the user segment may contain spaces.
  [/(?<=^|[\s'"`(=,[]|file:\/\/)(?:\/mnt\/[a-z])?\/(?:Users|home)\/(?:[^/\n'"`]{1,60}?(?=\/)|[^/\s'"`]+)/gim, '~'],
  [/(?<![\w])[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)(?:[^\\/\n'"`]{1,60}?(?=[\\/])|[^\\/\s'"`]+)/gi, '~'],
  [/-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]{0,40}PRIVATE KEY-----|$)/g, '<PRIVATE_KEY>'],
  // Everything before the last @ of a URL's authority: user, password, even an @ in the password.
  [/(?<![\w+.-])([a-z][a-z0-9+.-]{0,20}:\/\/)[^\s/?#]*@/gi, '$1<REDACTED>@'],
  // Bearer and basic credentials in any case, then whatever follows `Authorization:` after any
  // scheme word (`Token`, `Bot`, `Digest`, …), quoted or not.
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 <TOKEN>'],
  [
    /(?<![\w-])(['"]?authorization['"]?\s*[:=]\s*['"]?)(?!(?:[A-Za-z][\w-]{0,20}\s+)?<)(?:([A-Za-z][\w-]{0,20})\s+)?[^\s'"`,;]+/gi,
    redactAuthorization,
  ],
  // Quoted names: JSON and object literals, either quote.
  [new RegExp(`(['"]${SECRET_NAME}['"]\\s*:\\s*)${QUOTED}`, 'gi'), '$1$<q><REDACTED>$<q>'],
  // Bare names with a quoted value, with or without a type annotation.
  [new RegExp(`(${SECRET_NAME}\\s*${TYPE_ANNOTATION}[:=]\\s*)${QUOTED}`, 'gi'), '$1$<q><REDACTED>$<q>'],
  // Bare names with a bare value, except a type name in an annotation.
  [new RegExp(`(${SECRET_NAME}\\s*[:=]\\s*)${BARE_VALUE}`, 'gi'), '$1<REDACTED>'],
  // Upper-case environment names and camelCase names with the credential word inside them, which
  // the end-of-name keyword match above leaves out. Case-sensitive on purpose (no `i` flag).
  [new RegExp(`(${ENV_NAME}\\s*[:=]\\s*)${QUOTED}`, 'g'), '$1$<q><REDACTED>$<q>'],
  [new RegExp(`(${ENV_NAME}\\s*[:=]\\s*)${BARE_VALUE}`, 'g'), '$1<REDACTED>'],
  [new RegExp(`(${CAMEL_NAME}\\s*${TYPE_ANNOTATION}[:=]\\s*)${QUOTED}`, 'g'), '$1$<q><REDACTED>$<q>'],
  [new RegExp(`(${CAMEL_NAME}\\s*[:=]\\s*)${BARE_VALUE}`, 'g'), '$1<REDACTED>'],
  // npm credentials in .npmrc: `_auth` (base64 user:pass), `_authToken`, `_password`.
  [/(?<![\w-])(_auth(?:Token)?|_password)(\s*=\s*)(?!<)[^\s'"`]+/g, '$1$2<REDACTED>'],
  [new RegExp(`${NOT_HEX_BEFORE}0[xX][0-9a-fA-F]{64,}${NOT_HEX_AFTER}`, 'g'), '<HEX_SECRET>'],
  [new RegExp(`(?<![0-9a-fA-FxX])[0-9a-fA-F]{64,}${NOT_HEX_AFTER}`, 'g'), '<HEX_SECRET>'],
  [new RegExp(`${NOT_HEX_BEFORE}0[xX][0-9a-fA-F]{40}${NOT_HEX_AFTER}`, 'g'), '<ADDRESS>'],
  [/\beyJ[\w-]{1,4000}\.[\w-]{1,4000}\.[\w-]+/g, '<TOKEN>'],
  [/(?<![\w-])(?:sk|pk|rk)[-_](?:live[-_]|test[-_])?[A-Za-z0-9]{16,}/g, '<TOKEN>'],
  [/(?<![\w-])(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g, '<TOKEN>'],
  [/(?<![\w-])npm_[A-Za-z0-9]{36}(?![\w-])/g, '<TOKEN>'],
  [/(?<![\w-])xox[abprs]-[A-Za-z0-9-]{10,}/g, '<TOKEN>'],
  [/(?<![\w-])AKIA[0-9A-Z]{16}(?![\w-])/g, '<TOKEN>'],
  [/([?&][a-z_]{0,30}(?:token|key|secret|signature|sig|auth|password)=)[^&\s'"`]+/gi, '$1<REDACTED>'],
  [
    /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}(?![A-Za-z0-9-])/g,
    '<EMAIL>',
  ],
]
const LIMITS = { title: 120, description: 10000, workaround: 5000, fingerprint: 120, skill: 80, agent: 40 }
const INPUT_FIELDS = ['title', 'description', 'workaround', 'kind', 'fingerprint', 'skill', 'agent']

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

function findSceneRoot(start) {
  let current = resolve(start)
  while (true) {
    if (existsSync(join(current, 'scene.json'))) return current
    const parent = dirname(current)
    if (parent === current) return resolve(start)
    current = parent
  }
}

function isDisabledByEnv() {
  const value = (process.env.DCL_SDK_ISSUE_REPORTS || '').trim().toLowerCase()
  return ['off', '0', 'false', 'no', 'disabled'].includes(value)
}

function getEndpoint() {
  const url = process.env.DCL_SDK_ISSUE_REPORTS_URL || DEFAULT_ENDPOINT
  return url ? `${url.replace(/\/+$/, '')}/reports` : null
}

function readLedger(root) {
  const path = join(root, LEDGER_FILE)
  if (!existsSync(path)) return null
  try {
    const ledger = JSON.parse(readFileSync(path, 'utf8'))
    if (!Array.isArray(ledger.reports)) ledger.reports = []
    return ledger
  } catch {
    // A corrupt ledger must not be silently replaced: it holds the user's consent answer.
    throw new Error(`${path} is not valid JSON. Fix or delete it, then run this again.`)
  }
}

function ensureIgnored(root) {
  for (const name of IGNORE_FILES) {
    const path = join(root, name)
    const content = existsSync(path) ? readFileSync(path, 'utf8') : ''
    const lines = content.split(/\r?\n/).map(line => line.trim())
    if (lines.includes(LEDGER_FILE) || lines.includes(`/${LEDGER_FILE}`)) continue
    const separator = content === '' || content.endsWith('\n') ? '' : '\n'
    writeFileSync(path, `${content}${separator}${LEDGER_FILE}\n`)
  }
}

// Only called inside updateLedger, under the ledger lock.
function writeLedger(root, ledger) {
  ensureIgnored(root)
  const path = join(root, LEDGER_FILE)
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`)
  renameSync(temporary, path)
}

function getConsent(ledger) {
  if (isDisabledByEnv()) return 'denied'
  return ledger?.consent === 'granted' || ledger?.consent === 'denied' ? ledger.consent : 'unknown'
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Strips what must never leave the machine. The agent is told not to include any of this; this is the
 * safety net for when it does. The server applies its own pass as well.
 */
export function redact(text, root) {
  if (!text) return text
  let result = text
  for (const [path, placeholder] of [
    [root, '<SCENE>'],
    [homedir(), '~']
  ]) {
    if (path && path.length > 1) {
      result = result.replace(new RegExp(escapeRegExp(path), 'g'), placeholder)
      result = result.replace(new RegExp(escapeRegExp(path.replace(/\\/g, '/')), 'g'), placeholder)
    }
  }
  return REDACTIONS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), result)
}

export function validate(input) {
  const errors = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['the report must be a JSON object']
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

function detectSdkVersion(root) {
  const installed = readJson(join(root, 'node_modules', '@dcl', 'sdk', 'package.json'))
  if (installed?.version) return installed.version
  const manifest = readJson(join(root, 'package.json'))
  return manifest?.dependencies?.['@dcl/sdk'] || manifest?.devDependencies?.['@dcl/sdk'] || undefined
}

function buildPayload(input, root) {
  const payload = {
    clientReportId: randomUUID(),
    title: redact(input.title.trim(), root),
    description: redact(input.description.trim(), root),
    kind: input.kind,
    fingerprint: input.fingerprint
  }
  if (input.workaround?.trim()) payload.workaround = redact(input.workaround.trim(), root)
  if (input.skill) payload.skill = input.skill
  const sdkVersion = detectSdkVersion(root)
  if (sdkVersion) payload.sdkVersion = String(sdkVersion).slice(0, 40)
  payload.metadata = { os: platform(), node: process.versions.node }
  if (input.agent) payload.metadata.agent = redact(input.agent, root)
  return payload
}

/**
 * Sends one report. `sent` and `rejected` are final; `pending` means try again on a later run.
 * A 4xx other than 408/429 means the server will never accept this payload, so retrying is pointless.
 */
async function send(endpoint, payload) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    const body = await response.json().catch(() => ({}))
    if (response.ok) return { outcome: 'sent', issueNumber: body.issueNumber }
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      return { outcome: 'rejected', error: `HTTP ${response.status}${body.error ? `: ${body.error}` : ''}` }
    }
    const retryAfter = Number(response.headers.get('retry-after'))
    return {
      outcome: 'pending',
      error: `HTTP ${response.status}`,
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined
    }
  } catch (err) {
    return { outcome: 'pending', error: err.name === 'AbortError' ? 'timeout' : err.message }
  } finally {
    clearTimeout(timer)
  }
}

function applyResult(entry, result) {
  entry.status = result.outcome
  entry.lastAttemptAt = new Date().toISOString()
  if (result.outcome === 'pending') {
    entry.lastError = result.error
    return
  }
  // Once final, the payload has no further use; keeping only the summary keeps the file small.
  delete entry.payload
  delete entry.lastError
  if (result.issueNumber !== undefined) entry.issueNumber = result.issueNumber
  if (result.error) entry.error = result.error
}

function isInBackoff(ledger) {
  return Boolean(ledger?.backoffUntil) && Date.parse(ledger.backoffUntil) > Date.now()
}

function hasQueuedWork(ledger) {
  return (
    Boolean(getEndpoint()) &&
    getConsent(ledger) === 'granted' &&
    !isInBackoff(ledger) &&
    ledger.reports.some(entry => entry.status === 'pending' && entry.payload)
  )
}

function lockPath(root, kind) {
  mkdirSync(LOCK_DIR, { recursive: true, mode: 0o700 })
  return join(LOCK_DIR, `${createHash('sha256').update(root).digest('hex').slice(0, 16)}.${kind}.lock`)
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err.code === 'EPERM'
  }
}

/**
 * Whether a lock file's holder is gone. A lock that cannot be parsed is judged by its file's age
 * instead, so a lock left empty by a crash or a full disk cannot block the scene forever.
 */
function isStale(path, content, staleMs) {
  let holder
  try {
    holder = JSON.parse(content)
  } catch {
    return Date.now() - statSync(path).mtimeMs > Math.min(staleMs, UNREADABLE_LOCK_STALE_MS)
  }
  return !isAlive(holder.pid) || Date.now() - holder.at > staleMs
}

/**
 * Takes a lock file, or returns undefined if another live process holds it.
 *
 * The file holds an owner token, the pid and the time. It is stale once its process is gone, it is
 * older than `staleMs`, or it cannot be parsed and is a couple of seconds old. A stale lock is moved aside with a rename, which succeeds for exactly
 * one process; if what was moved turns out to be a fresh lock someone else just took, it is put
 * back. The returned release only removes the file if it still holds this owner's token.
 */
function tryLock(path, staleMs) {
  const token = randomUUID()
  const content = JSON.stringify({ token, pid: process.pid, at: Date.now() })
  const take = () => writeFileSync(path, content, { flag: 'wx' })
  try {
    take()
  } catch {
    try {
      const observed = readFileSync(path, 'utf8')
      if (!isStale(path, observed, staleMs)) return undefined
      const aside = `${path}.${token}.stale`
      renameSync(path, aside)
      if (readFileSync(aside, 'utf8') !== observed) {
        try {
          linkSync(aside, path)
        } catch {}
        unlinkSync(aside)
        return undefined
      }
      unlinkSync(aside)
      take()
    } catch {
      return undefined
    }
  }
  return () => {
    try {
      if (JSON.parse(readFileSync(path, 'utf8')).token === token) unlinkSync(path)
    } catch {}
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Reads, changes and writes the ledger under a short per-scene lock, so a submit and a background
 * run can never overwrite each other's changes. The lock is held only around the file work, never
 * during a network call.
 *
 * @param mutate Receives the current ledger (or null) and returns the ledger to write, or null
 */
function updateLedger(root, mutate) {
  const path = lockPath(root, 'ledger')
  const deadline = Date.now() + LEDGER_LOCK_WAIT_MS
  let release = tryLock(path, LEDGER_LOCK_STALE_MS)
  while (!release) {
    if (Date.now() > deadline) throw new Error('the scene\'s report ledger is locked by another run')
    sleepSync(20)
    release = tryLock(path, LEDGER_LOCK_STALE_MS)
  }
  try {
    const next = mutate(readLedger(root))
    if (next) writeLedger(root, next)
    return next
  } finally {
    release()
  }
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
 * Sends queued reports, oldest first, up to MAX_FLUSH_PER_RUN, stopping at the first one that still
 * fails. One run per scene at a time. Each result is written back under the ledger lock, so a report
 * queued meanwhile is kept.
 *
 * A 429 or 503, or no answer at all, puts background runs in backoff: they leave the service alone
 * until Retry-After, or DEFAULT_BACKOFF_MS, has passed. A run started by hand ignores the backoff.
 */
async function flush(root, options = {}) {
  const release = tryLock(lockPath(root, 'send'), SEND_LOCK_STALE_MS)
  if (!release) return 'busy\nAnother run is already sending this scene\'s queued reports.'
  const counts = { sent: 0, rejected: 0, pending: 0 }
  try {
    for (let attempt = 0; attempt < MAX_FLUSH_PER_RUN; attempt++) {
      const ledger = readLedger(root)
      if (!ledger || !getEndpoint() || getConsent(ledger) !== 'granted') break
      if (options.background && isInBackoff(ledger)) break
      const entry = ledger.reports.find(candidate => candidate.status === 'pending' && candidate.payload)
      if (!entry) break
      const result = await send(getEndpoint(), entry.payload)
      updateLedger(root, current => {
        const target = current?.reports.find(candidate => candidate.clientReportId === entry.clientReportId)
        if (!target) return null
        applyResult(target, result)
        if (result.outcome === 'pending') {
          current.backoffUntil = new Date(Date.now() + (result.retryAfterMs ?? DEFAULT_BACKOFF_MS)).toISOString()
        } else {
          delete current.backoffUntil
        }
        return current
      })
      counts[result.outcome]++
      if (result.outcome === 'pending') break
    }
  } finally {
    release()
  }
  const left = readLedger(root)?.reports.filter(entry => entry.status === 'pending').length ?? 0
  return `flushed\n${counts.sent} sent, ${counts.rejected} rejected, ${left} still queued.`
}

function readStdin() {
  return new Promise((resolvePromise, reject) => {
    if (process.stdin.isTTY) return reject(new UsageError('Pipe the report JSON into stdin, or pass --file'))
    let data = ''
    // An agent shell can leave stdin open with nothing on it; fail instead of hanging forever.
    const timer = setTimeout(() => {
      if (data === '') reject(new UsageError('No report JSON arrived on stdin. Pipe it in, or pass --file'))
    }, 5000)
    timer.unref()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => (data += chunk))
    process.stdin.on('end', () => {
      clearTimeout(timer)
      resolvePromise(data)
    })
    process.stdin.on('error', reject)
  })
}

function consentLine(consent) {
  if (consent === 'unknown')
    return 'consent:unknown\nAsk the user once whether SDK issue reports may be sent, then run: report.mjs consent --grant (or --deny)'
  return isDisabledByEnv()
    ? 'consent:denied\nReporting is disabled by DCL_SDK_ISSUE_REPORTS. Do not ask; apply the workaround.'
    : 'consent:denied\nThe user declined SDK issue reports for this scene. Do not ask again; apply the workaround.'
}

async function check(root, options) {
  if (!options.fingerprint) throw new UsageError('check needs --fingerprint <slug>')
  if (!SLUG.test(options.fingerprint)) throw new UsageError('--fingerprint must be a lowercase kebab-case slug')
  const ledger = readLedger(root)
  const consent = getConsent(ledger)
  if (consent !== 'granted') return consentLine(consent)
  if (hasQueuedWork(ledger)) startBackgroundFlush(root)
  const known = ledger.reports.find(entry => entry.fingerprint === options.fingerprint)
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
  const note = isDisabledByEnv() ? '\nNote: DCL_SDK_ISSUE_REPORTS disables reporting on this machine regardless.' : ''
  return `consent:${ledger.consent}${note}`
}

async function submit(root, options) {
  const ledger = readLedger(root)
  const consentState = getConsent(ledger)
  if (consentState !== 'granted') return consentLine(consentState)

  const raw = options.file ? readFileSync(options.file, 'utf8') : await readStdin()
  let input
  try {
    input = JSON.parse(raw)
  } catch {
    throw new UsageError('invalid: the report is not valid JSON')
  }
  const errors = validate(input)
  if (errors.length > 0) throw new UsageError(`invalid: ${errors.join('; ')}`)

  let known
  updateLedger(root, current => {
    const latest = current || ledger
    known = latest.reports.find(entry => entry.fingerprint === input.fingerprint)
    if (known) return null
    const payload = buildPayload(input, root)
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

  if (!getEndpoint()) return 'queued\nSaved locally; it will be sent automatically once the reporting endpoint is live.'
  startBackgroundFlush(root)
  return 'queued\nSaved; it is being sent to the Decentraland SDK team in the background.'
}

function status(root) {
  const ledger = readLedger(root)
  const counts = { pending: 0, sent: 0, rejected: 0 }
  for (const entry of ledger?.reports || []) counts[entry.status] = (counts[entry.status] || 0) + 1
  return [
    `consent:${getConsent(ledger)}`,
    `scene: ${root}`,
    `endpoint: ${getEndpoint() || 'not configured yet'}`,
    `reports: ${counts.sent} sent, ${counts.pending} pending, ${counts.rejected} rejected`
  ].join('\n')
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2))
  const root = options.dir ? resolve(options.dir) : findSceneRoot(process.cwd())
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

const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntryPoint) {
  main().then(
    output => console.log(output),
    err => {
      console.log(err instanceof UsageError ? err.message : `error: ${err.message}`)
      process.exitCode = err instanceof UsageError ? 2 : 1
    }
  )
}
