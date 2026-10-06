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
// Sending never blocks the agent: submit and check only start a detached background process that
// sends whatever is queued, so a slow or unreachable service costs the user no time.
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
import { closeSync, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, platform, tmpdir } from 'node:os'
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
// Longer than a full background run can take (MAX_FLUSH_PER_RUN request timeouts), so a lock older
// than this belongs to a run that died, and is taken over.
const LOCK_STALE_MS = 5 * 60_000

const KINDS = ['bug', 'limitation', 'docs-gap']
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
// A run of 32+ hex characters, with or without 0x, once the dashes are removed: a key, hash or
// token rather than words, even split into short segments. Slugs reach the issue footer and
// labels, where the service does not redact.
const HEX_RUN = /(?:0x)?[0-9a-f]{32,}/
const carriesHex = slug => HEX_RUN.test(slug.replace(/-/g, ''))
// Names whose value is a credential, in `name: value`, `name = 'value'` and JSON pairs. Kept in
// step with the reporting service's redaction (workers/sdk-issue-reports in cloudflare-workers).
const SECRET_NAME =
  '[A-Za-z0-9_-]*(?:api[_-]?key|private[_-]?key|access[_-]?key|secret|token|passw(?:or)?d|passphrase|mnemonic|seed[_-]?phrase|credential|auth)[A-Za-z0-9_-]*'

/** Type names that follow `name:` in TypeScript annotations; not values, so left alone. */
const TYPE_NAMES = '(?:string|number|boolean|undefined|null|any|unknown)\\b'

/** Hex runs are bounded by non-hex characters, not word boundaries, so `KEY_<hex>` is caught too. */
const NOT_HEX_BEFORE = '(?<![0-9a-fA-F])'
const NOT_HEX_AFTER = '(?![0-9a-fA-F])'
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
    if (key === 'grant' || key === 'deny') {
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
  return result
    .replace(/(?<=^|[\s'"`(=,[]|file:\/\/)(?:\/mnt\/[a-z])?\/(?:Users|home)\/[^/\s'"`]+/gim, '~')
    .replace(/(?<![\w])[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)[^\\/\s'"`]+/gi, '~')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '<PRIVATE_KEY>')
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#@:]+:[^\s/?#@]+@/gi, '$1<REDACTED>@')
    .replace(new RegExp(`("${SECRET_NAME}"\\s*:\\s*")(?:[^"\\\\\\n]|\\\\.)*"`, 'gi'), '$1<REDACTED>"')
    .replace(
      new RegExp(`(\\b${SECRET_NAME}\\s*[:=]\\s*)(['"\`])(?:\\\\.|(?!\\2)[^\\\\\\n])+\\2`, 'gi'),
      '$1$2<REDACTED>$2',
    )
    .replace(
      new RegExp(`(\\b${SECRET_NAME}\\s*[:=]\\s*)(?![\\s'"\`<]|${TYPE_NAMES})[^\\s,;'"\`&)}\\]]+`, 'gi'),
      '$1<REDACTED>',
    )
    .replace(
      /\b([A-Z0-9_]*(?:_KEY|KEY_|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?|MNEMONIC|SEED)[A-Z0-9_]*)=(?!<)[^\s'"`&]+/g,
      '$1=<REDACTED>',
    )
    .replace(new RegExp(`${NOT_HEX_BEFORE}0[xX][0-9a-fA-F]{64,}${NOT_HEX_AFTER}`, 'g'), '<HEX_SECRET>')
    .replace(new RegExp(`(?<![0-9a-fA-FxX])[0-9a-fA-F]{64,}${NOT_HEX_AFTER}`, 'g'), '<HEX_SECRET>')
    .replace(new RegExp(`${NOT_HEX_BEFORE}0[xX][0-9a-fA-F]{40}${NOT_HEX_AFTER}`, 'g'), '<ADDRESS>')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<TOKEN>')
    .replace(/\b(?:sk|pk|rk)[-_](?:live|test)?[-_]?[A-Za-z0-9]{16,}\b/g, '<TOKEN>')
    .replace(/\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g, '<TOKEN>')
    .replace(/\bnpm_[A-Za-z0-9]{36}\b/g, '<TOKEN>')
    .replace(/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, '<TOKEN>')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '<TOKEN>')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/g, '$1 <TOKEN>')
    .replace(/([?&](?:[a-z_]*token|key|secret|signature|sig|auth|password)=)[^&\s'"`]+/gi, '$1<REDACTED>')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<EMAIL>')
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
  else if (typeof input.fingerprint === 'string' && carriesHex(input.fingerprint))
    errors.push('"fingerprint" looks like a key or hash; describe the area and symptom instead')
  if (typeof input.skill === 'string' && input.skill !== '' && !SLUG.test(input.skill))
    errors.push('"skill" must be a skill name, e.g. build-ui')
  else if (typeof input.skill === 'string' && carriesHex(input.skill)) errors.push('"skill" looks like a key or hash')
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
    return { outcome: 'pending', error: `HTTP ${response.status}` }
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

function hasQueuedWork(ledger) {
  return (
    Boolean(getEndpoint()) &&
    getConsent(ledger) === 'granted' &&
    ledger.reports.some(entry => entry.status === 'pending' && entry.payload)
  )
}

/**
 * One background run per scene at a time, so two runs never send the same report at once. The
 * lock lives in the OS temp folder, keyed by the scene path, so it never shows up in the scene.
 */
function acquireLock(root) {
  const path = join(tmpdir(), `dcl-sdk-reports-${createHash('sha256').update(root).digest('hex').slice(0, 16)}.lock`)
  const release = () => {
    try {
      unlinkSync(path)
    } catch {}
  }
  try {
    closeSync(openSync(path, 'wx'))
    return release
  } catch {}
  try {
    if (Date.now() - statSync(path).mtimeMs < LOCK_STALE_MS) return undefined
    unlinkSync(path)
    closeSync(openSync(path, 'wx'))
    return release
  } catch {
    return undefined
  }
}

/**
 * Starts a detached process that sends the queued reports, and returns at once. If it cannot be
 * started, the reports simply stay queued for the next run.
 */
function startBackgroundFlush(root) {
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'flush', '--dir', root], {
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
 * Sends queued reports, oldest first, and waits for the result. This is what the background
 * process runs. The ledger is re-read around every request, because the agent can queue another
 * report while one is in flight.
 */
async function flush(root) {
  const release = acquireLock(root)
  if (!release) return 'busy\nAnother run is already sending this scene\'s queued reports.'
  const counts = { sent: 0, rejected: 0, pending: 0 }
  try {
    for (let attempt = 0; attempt < MAX_FLUSH_PER_RUN; attempt++) {
      const ledger = readLedger(root)
      if (!ledger || !hasQueuedWork(ledger)) break
      const entry = ledger.reports.find(candidate => candidate.status === 'pending' && candidate.payload)
      const result = await send(getEndpoint(), entry.payload)
      const fresh = readLedger(root)
      const target = fresh?.reports.find(candidate => candidate.clientReportId === entry.clientReportId)
      if (target) {
        applyResult(target, result)
        writeLedger(root, fresh)
      }
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
  const ledger = readLedger(root) || { reports: [] }
  ledger.consent = options.grant ? 'granted' : 'denied'
  ledger.consentAt = new Date().toISOString()
  writeLedger(root, ledger)
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

  // Re-read: a background run may have updated the ledger while the report was being read in.
  const latest = readLedger(root) || ledger
  const known = latest.reports.find(entry => entry.fingerprint === input.fingerprint)
  if (known) return `already-reported\nThis issue was already reported from this scene (${known.status}).`

  const payload = buildPayload(input, root)
  const entry = {
    clientReportId: payload.clientReportId,
    fingerprint: payload.fingerprint,
    title: payload.title,
    status: 'pending',
    createdAt: new Date().toISOString(),
    payload
  }
  // Queued first and sent by a background process, so the agent never waits on the network.
  latest.reports.push(entry)
  writeLedger(root, latest)

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
      return flush(root)
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
