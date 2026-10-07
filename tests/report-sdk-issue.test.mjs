// Tests for report-sdk-issue/scripts/report.mjs. Run with: node --test tests/
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { spawn } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { redact, validate } from '../report-sdk-issue/scripts/report.mjs'

const SCRIPT = fileURLToPath(new URL('../report-sdk-issue/scripts/report.mjs', import.meta.url))

const REPORT = {
  title: 'Controlled Input does not follow a programmatic reset',
  description: 'Setting value to "" after submit leaves the old text visible.',
  workaround: 'Remount the Input with a new key.',
  kind: 'bug',
  fingerprint: 'ui-input-controlled-reset',
  skill: 'build-ui'
}

// Each test gets its own home folder, so nothing the script reads from HOME leaks between tests.
let homeDir

function run(sceneDir, args, { input, raw, env = {} } = {}) {
  return new Promise(resolvePromise => {
    const child = execFile(
      process.execPath,
      [SCRIPT, ...args, '--dir', sceneDir],
      {
        env: {
          ...process.env,
          HOME: homeDir,
          USERPROFILE: homeDir,
          DCL_SDK_ISSUE_REPORTS: '',
          DCL_SDK_ISSUE_REPORTS_URL: '',
          ...env
        }
      },
      (error, stdout) => resolvePromise({ code: error ? error.code : 0, stdout, first: stdout.split('\n')[0] })
    )
    child.stdin.end(raw !== undefined ? raw : input === undefined ? '' : JSON.stringify(input))
  })
}

const ledgerLockPath = sceneDir => join(sceneDir, '.dcl-sdk-reports.lock')
const sendLockPath = sceneDir => join(sceneDir, '.dcl-sdk-reports.send.lock')

function writeEmptyLock(path, ageMs) {
  writeFileSync(path, '')
  const at = (Date.now() - ageMs) / 1000
  utimesSync(path, at, at)
}

const flushWith = (sceneDir, url) => run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: url } })

async function queueReports(sceneDir, count) {
  for (let i = 0; i < count; i++) await run(sceneDir, ['submit'], { input: { ...REPORT, fingerprint: `issue-number-${i}` } })
}

function readLedger(sceneDir) {
  return JSON.parse(readFileSync(join(sceneDir, '.dcl-sdk-reports.json'), 'utf8'))
}

/** Polls the ledger until the background process has done what the test expects, or fails. */
async function waitForLedger(sceneDir, predicate, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const ledger = readLedger(sceneDir)
    if (predicate(ledger)) return ledger
    if (Date.now() > deadline) throw new Error(`ledger never matched: ${JSON.stringify(ledger)}`)
    await new Promise(resolveTimer => setTimeout(resolveTimer, 50))
  }
}

// `respond` returning null leaves the request hanging, like an unresponsive service, until the
// server is closed: then it is answered 503, so no background process outlives the test.
function startServer(respond) {
  const requests = []
  const hanging = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => (body += chunk))
    req.on('end', () => {
      const parsed = JSON.parse(body)
      requests.push({ method: req.method, url: req.url, body: parsed, bytes: Buffer.byteLength(body) })
      const answer = respond(parsed, requests.length)
      if (!answer) return hanging.push(res)
      const contentType = answer.raw === undefined ? 'application/json' : 'text/html'
      res.writeHead(answer.status, { 'Content-Type': contentType, ...answer.headers })
      res.end(answer.raw === undefined ? JSON.stringify(answer.json) : answer.raw)
    })
  })
  return new Promise(resolvePromise =>
    server.listen(0, '127.0.0.1', () =>
      resolvePromise({
        server,
        requests,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => {
          for (const res of hanging) {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end('{}')
          }
          server.closeAllConnections()
          server.close()
        }
      })
    )
  )
}

describe('report-sdk-issue', () => {
  let sceneDir

  beforeEach(() => {
    sceneDir = mkdtempSync(join(tmpdir(), 'dcl-report-'))
    homeDir = mkdtempSync(join(tmpdir(), 'dcl-report-home-'))
    writeFileSync(join(sceneDir, 'scene.json'), '{}')
    writeFileSync(join(sceneDir, '.gitignore'), 'node_modules')
  })

  afterEach(() => {
    rmSync(sceneDir, { recursive: true, force: true })
    rmSync(homeDir, { recursive: true, force: true })
  })

  describe('when the user has not answered the consent question', () => {
    it('should report consent:unknown on check', async () => {
      const { first } = await run(sceneDir, ['check', '--fingerprint', REPORT.fingerprint])
      assert.equal(first, 'consent:unknown')
    })

    it('should refuse to submit and not create the ledger', async () => {
      const { first } = await run(sceneDir, ['submit'], { input: REPORT })
      assert.equal(first, 'consent:unknown')
      assert.equal(existsSync(join(sceneDir, '.dcl-sdk-reports.json')), false)
    })
  })

  describe('when the user grants consent', () => {
    beforeEach(async () => {
      await run(sceneDir, ['consent', '--grant'])
    })

    it('should add the ledger and its lock files to .gitignore exactly once', async () => {
      await run(sceneDir, ['consent', '--grant'])
      assert.equal(readFileSync(join(sceneDir, '.gitignore'), 'utf8'), 'node_modules\n.dcl-sdk-reports*\n')
    })

    it('should not create a .dclignore the scene does not have', () => {
      assert.equal(existsSync(join(sceneDir, '.dclignore')), false)
    })

    describe('and the reporting endpoint is not configured', () => {
      it('should queue the report as pending', async () => {
        const { first } = await run(sceneDir, ['submit'], { input: REPORT })
        assert.equal(first, 'queued')
        assert.equal(readLedger(sceneDir).reports[0].status, 'pending')
      })

      it('should treat the queued fingerprint as reported', async () => {
        await run(sceneDir, ['submit'], { input: REPORT })
        const { first } = await run(sceneDir, ['check', '--fingerprint', REPORT.fingerprint])
        assert.equal(first, 'reported')
      })
    })

    describe('and the endpoint accepts the report', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 42 } }))
      })

      afterEach(() => {
        mock.close()
      })

      it('should return queued at once and send it in the background, recording the issue number', async () => {
        const { first } = await run(sceneDir, ['submit'], { input: REPORT, env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        const ledger = await waitForLedger(sceneDir, l => l.reports[0].status !== 'pending')
        assert.deepEqual(
          {
            first,
            url: mock.requests[0].url,
            fingerprint: mock.requests[0].body.fingerprint,
            status: ledger.reports[0].status,
            issueNumber: ledger.reports[0].issueNumber
          },
          { first: 'queued', url: '/reports', fingerprint: REPORT.fingerprint, status: 'sent', issueNumber: 42 }
        )
      })

      it('should not send the same fingerprint twice', async () => {
        const env = { DCL_SDK_ISSUE_REPORTS_URL: mock.url }
        await run(sceneDir, ['submit'], { input: REPORT, env })
        await waitForLedger(sceneDir, l => l.reports[0].status === 'sent')
        const { first } = await run(sceneDir, ['submit'], { input: REPORT, env })
        assert.deepEqual({ first, requests: mock.requests.length }, { first: 'already-reported', requests: 1 })
      })
    })

    describe('and the endpoint never answers', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => null)
      })

      afterEach(() => {
        mock.close()
      })

      it('should still return from submit at once, leaving the report queued', async () => {
        const started = Date.now()
        const { first } = await run(sceneDir, ['submit'], { input: REPORT, env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.deepEqual(
          { first, fast: Date.now() - started < 3000, status: readLedger(sceneDir).reports[0].status },
          { first: 'queued', fast: true, status: 'pending' }
        )
      })
    })

    describe('and the endpoint fails with a server error, then recovers', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer((_body, count) =>
          count === 1 ? { status: 503, json: { error: 'busy' } } : { status: 201, json: { issueNumber: 7 } }
        )
      })

      afterEach(() => {
        mock.close()
      })

      it('should back off: a later check leaves the service alone', async () => {
        const env = { DCL_SDK_ISSUE_REPORTS_URL: mock.url }
        await run(sceneDir, ['submit'], { input: REPORT, env })
        const ledger = await waitForLedger(sceneDir, l => Boolean(l.backoffUntil))
        await run(sceneDir, ['check', '--fingerprint', 'another-issue'], { env })
        await new Promise(resolveTimer => setTimeout(resolveTimer, 500))
        assert.deepEqual(
          { requests: mock.requests.length, status: readLedger(sceneDir).reports[0].status, backoff: Boolean(ledger.backoffUntil) },
          { requests: 1, status: 'pending', backoff: true }
        )
      })

      it('should resend with the same clientReportId when flushed by hand, and clear the backoff', async () => {
        const env = { DCL_SDK_ISSUE_REPORTS_URL: mock.url }
        await run(sceneDir, ['submit'], { input: REPORT, env })
        await waitForLedger(sceneDir, l => Boolean(l.backoffUntil))
        await run(sceneDir, ['flush'], { env })
        const ledger = readLedger(sceneDir)
        assert.deepEqual(
          {
            sameId: mock.requests[1].body.clientReportId === mock.requests[0].body.clientReportId,
            status: ledger.reports[0].status,
            backoff: ledger.backoffUntil
          },
          { sameId: true, status: 'sent', backoff: undefined }
        )
      })
    })

    describe('and the service sends Retry-After with a 429', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 429, json: {}, headers: { 'Retry-After': '120' } }))
      })

      afterEach(() => {
        mock.close()
      })

      it('should back off for that long', async () => {
        const started = Date.now()
        await run(sceneDir, ['submit'], { input: REPORT, env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        const ledger = await waitForLedger(sceneDir, l => Boolean(l.backoffUntil))
        const backoffMs = Date.parse(ledger.backoffUntil) - started
        assert.ok(backoffMs > 100_000 && backoffMs < 140_000, `backoff was ${backoffMs}ms`)
      })
    })

    describe('and the endpoint rejects the report', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 400, json: { error: 'bad title' } }))
      })

      afterEach(() => {
        mock.close()
      })

      it('should mark it rejected and never retry it', async () => {
        const env = { DCL_SDK_ISSUE_REPORTS_URL: mock.url }
        await run(sceneDir, ['submit'], { input: REPORT, env })
        await waitForLedger(sceneDir, l => l.reports[0].status === 'rejected')
        const { first } = await run(sceneDir, ['flush'], { env })
        assert.deepEqual({ first, requests: mock.requests.length }, { first: 'flushed', requests: 1 })
      })
    })

    describe('and reports were queued before the endpoint existed', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 9 } }))
        await run(sceneDir, ['submit'], { input: REPORT })
      })

      afterEach(() => {
        mock.close()
      })

      it('should send them when flush runs against the endpoint', async () => {
        const { stdout } = await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.deepEqual(
          { stdout: stdout.trim(), status: readLedger(sceneDir).reports[0].status },
          { stdout: 'flushed\n1 sent, 0 rejected, 0 given up, 0 still queued.', status: 'sent' }
        )
      })
    })

    describe('and several reports are queued', () => {
      let mock

      afterEach(() => {
        mock.close()
      })

      it('should send every one in a single run, oldest first', async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 1 } }))
        await queueReports(sceneDir, 7)
        const { stdout } = await flushWith(sceneDir, mock.url)
        assert.deepEqual(
          { stdout: stdout.trim(), first: mock.requests[0].body.fingerprint },
          { stdout: 'flushed\n7 sent, 0 rejected, 0 given up, 0 still queued.', first: 'issue-number-0' }
        )
      })

      it('should stop at the first report the service cannot take', async () => {
        mock = await startServer(() => ({ status: 503, json: {} }))
        await queueReports(sceneDir, 3)
        const { stdout } = await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.deepEqual(
          { stdout: stdout.trim(), requests: mock.requests.length },
          { stdout: 'flushed\n0 sent, 0 rejected, 0 given up, 3 still queued.', requests: 1 }
        )
      })
    })

    describe('and another live run holds the send lock', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 1 } }))
        await queueReports(sceneDir, 1)
        writeFileSync(sendLockPath(sceneDir), JSON.stringify({ token: 'other', pid: process.pid, at: Date.now() }))
      })

      afterEach(() => {
        mock.close()
      })

      it('should answer busy and send nothing', async () => {
        const { first } = await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.deepEqual({ first, requests: mock.requests.length }, { first: 'busy', requests: 0 })
      })

      it('should leave that run\'s lock in place', async () => {
        await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.equal(JSON.parse(readFileSync(sendLockPath(sceneDir), 'utf8')).token, 'other')
      })
    })

    describe('and the send lock belongs to a run that died', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 1 } }))
        await queueReports(sceneDir, 1)
        writeFileSync(sendLockPath(sceneDir), JSON.stringify({ token: 'dead', pid: 2 ** 22 + 12345, at: Date.now() }))
      })

      afterEach(() => {
        mock.close()
      })

      it('should take the lock over and send, then release it', async () => {
        const { first } = await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.deepEqual(
          { first, requests: mock.requests.length, lockLeft: existsSync(sendLockPath(sceneDir)) },
          { first: 'flushed', requests: 1, lockLeft: false }
        )
      })
    })

    describe('and a lock file was left empty by a crash', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 1 } }))
        await queueReports(sceneDir, 1)
      })

      afterEach(() => {
        mock.close()
      })

      it('should take an old empty send lock over and send', async () => {
        writeEmptyLock(sendLockPath(sceneDir), 10_000)
        const { first } = await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.deepEqual({ first, requests: mock.requests.length }, { first: 'flushed', requests: 1 })
      })

      it('should still treat a just-created empty lock as held', async () => {
        // A second in the future, so a slow runner cannot age it past the two-second limit.
        writeEmptyLock(sendLockPath(sceneDir), -1000)
        const { first } = await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.equal(first, 'busy')
      })

      it('should take over a lock whose content is valid JSON but not a lock record', async () => {
        writeEmptyLock(sendLockPath(sceneDir), 10_000)
        writeFileSync(sendLockPath(sceneDir), 'null')
        const at = (Date.now() - 10_000) / 1000
        utimesSync(sendLockPath(sceneDir), at, at)
        const { first } = await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.equal(first, 'flushed')
      })

      it('should take over an empty lock dated far in the future', async () => {
        writeEmptyLock(sendLockPath(sceneDir), -60_000)
        const { first } = await run(sceneDir, ['flush'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        assert.equal(first, 'flushed')
      })

      it('should not block submit when the ledger lock is the one left empty', async () => {
        writeEmptyLock(ledgerLockPath(sceneDir), 10_000)
        const { first } = await run(sceneDir, ['submit'], { input: { ...REPORT, fingerprint: 'after-a-crash' } })
        assert.equal(first, 'queued')
      })
    })

    describe('and reports are submitted while background runs are sending', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 1 } }))
      })

      afterEach(() => {
        mock.close()
      })

      it('should keep every report and send each once', async () => {
        const env = { DCL_SDK_ISSUE_REPORTS_URL: mock.url }
        for (let i = 0; i < 20; i++) {
          await run(sceneDir, ['submit'], { input: { ...REPORT, fingerprint: `race-${i}` }, env })
        }
        let ledger = readLedger(sceneDir)
        for (let round = 0; round < 10 && ledger.reports.some(r => r.status === 'pending'); round++) {
          await run(sceneDir, ['flush'], { env })
          ledger = readLedger(sceneDir)
        }
        const sentIds = new Set(mock.requests.map(request => request.body.clientReportId))
        assert.deepEqual(
          {
            kept: ledger.reports.length,
            sent: ledger.reports.filter(r => r.status === 'sent').length,
            uniqueRequests: sentIds.size
          },
          { kept: 20, sent: 20, uniqueRequests: 20 }
        )
      })
    })

    describe('and the endpoint answers with something other than the service', () => {
      let mock
      let answer

      beforeEach(async () => {
        mock = await startServer(() => answer)
        await queueReports(sceneDir, 1)
      })

      afterEach(() => {
        mock.close()
      })

      describe('and it is a redirect', () => {
        beforeEach(() => {
          answer = { status: 302, raw: '', headers: { Location: '/login' } }
        })

        it('should not follow it, and keep the report queued behind a backoff', async () => {
          await flushWith(sceneDir, mock.url)
          const ledger = readLedger(sceneDir)
          assert.deepEqual(
            { requests: mock.requests.length, status: ledger.reports[0].status, backoff: Boolean(ledger.backoffUntil) },
            { requests: 1, status: 'pending', backoff: true }
          )
        })
      })

      describe('and it is a 200 page that is not the service JSON', () => {
        beforeEach(() => {
          answer = { status: 200, raw: '<html>Sign in to the network</html>' }
        })

        it('should keep the report queued', async () => {
          await flushWith(sceneDir, mock.url)
          assert.equal(readLedger(sceneDir).reports[0].status, 'pending')
        })
      })

      describe('and it is a 404 from a proxy or a wrong URL', () => {
        beforeEach(() => {
          answer = { status: 404, raw: 'Not Found' }
        })

        it('should keep the report queued rather than reject it', async () => {
          await flushWith(sceneDir, mock.url)
          assert.equal(readLedger(sceneDir).reports[0].status, 'pending')
        })
      })
    })

    describe('and one queued report keeps failing with a server error', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(body => (body.fingerprint === 'poison' ? { status: 500, json: {} } : { status: 201, json: { issueNumber: 3 } }))
        await run(sceneDir, ['submit'], { input: { ...REPORT, fingerprint: 'poison' } })
        await queueReports(sceneDir, 2)
      })

      afterEach(() => {
        mock.close()
      })

      it('should still send the reports queued after it', async () => {
        const { stdout } = await flushWith(sceneDir, mock.url)
        assert.equal(stdout.trim(), 'flushed\n2 sent, 0 rejected, 0 given up, 1 still queued.')
      })

      it('should give it up after five attempts and allow it to be reported again', async () => {
        for (let i = 0; i < 5; i++) await flushWith(sceneDir, mock.url)
        const status = readLedger(sceneDir).reports.find(r => r.fingerprint === 'poison').status
        const { first } = await run(sceneDir, ['submit'], { input: { ...REPORT, fingerprint: 'poison' } })
        assert.deepEqual({ status, first }, { status: 'failed', first: 'queued' })
      })
    })

    describe('and the service sends an extreme or dated Retry-After', () => {
      let mock
      let retryAfter

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 429, json: {}, headers: { 'Retry-After': retryAfter } }))
        await queueReports(sceneDir, 1)
      })

      afterEach(() => {
        mock.close()
      })

      describe('and it asks for years', () => {
        beforeEach(() => {
          retryAfter = '999999999'
        })

        it('should back off for at most a day', async () => {
          await flushWith(sceneDir, mock.url)
          const backoffMs = Date.parse(readLedger(sceneDir).backoffUntil) - Date.now()
          assert.ok(backoffMs > 23 * 3600_000 && backoffMs <= 24 * 3600_000, `backoff was ${backoffMs}ms`)
        })
      })

      describe('and it is an HTTP date', () => {
        beforeEach(() => {
          retryAfter = new Date(Date.now() + 120_000).toUTCString()
        })

        it('should back off until that date', async () => {
          await flushWith(sceneDir, mock.url)
          const backoffMs = Date.parse(readLedger(sceneDir).backoffUntil) - Date.now()
          assert.ok(backoffMs > 100_000 && backoffMs < 125_000, `backoff was ${backoffMs}ms`)
        })
      })
    })

    describe('and the report is within the field limits but large in bytes', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 5 } }))
        await run(sceneDir, ['submit'], {
          input: { ...REPORT, description: '\u0001'.repeat(10_000), workaround: '😀'.repeat(2500) }
        })
      })

      afterEach(() => {
        mock.close()
      })

      it('should fit the body under the service limit and send it', async () => {
        await flushWith(sceneDir, mock.url)
        assert.deepEqual(
          { underLimit: mock.requests[0].bytes <= 30_000, status: readLedger(sceneDir).reports[0].status },
          { underLimit: true, status: 'sent' }
        )
      })
    })

    describe('and the scene depends on the SDK through a local path', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 5 } }))
        writeFileSync(join(sceneDir, 'package.json'), JSON.stringify({ dependencies: { '@dcl/sdk': 'file:../../jane/sdk' } }))
        await queueReports(sceneDir, 1)
      })

      afterEach(() => {
        mock.close()
      })

      it('should leave the SDK version out', async () => {
        await flushWith(sceneDir, mock.url)
        assert.equal(mock.requests[0].body.sdkVersion, undefined)
      })
    })

    describe('and the scene depends on a published SDK version', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 5 } }))
        writeFileSync(join(sceneDir, 'package.json'), JSON.stringify({ dependencies: { '@dcl/sdk': '^7.8.1' } }))
        await queueReports(sceneDir, 1)
      })

      afterEach(() => {
        mock.close()
      })

      it('should send it', async () => {
        await flushWith(sceneDir, mock.url)
        assert.equal(mock.requests[0].body.sdkVersion, '^7.8.1')
      })
    })

    describe('and a live process holds a send lock dated far in the future', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 1 } }))
        await queueReports(sceneDir, 1)
        writeFileSync(sendLockPath(sceneDir), JSON.stringify({ token: 'skewed', pid: process.pid, at: Date.now() + 3600_000 }))
      })

      afterEach(() => {
        mock.close()
      })

      it('should take the lock over and send', async () => {
        const { first } = await flushWith(sceneDir, mock.url)
        assert.deepEqual({ first, requests: mock.requests.length }, { first: 'flushed', requests: 1 })
      })
    })

    describe('and the report file is UTF-16 with a byte order mark', () => {
      let file

      beforeEach(() => {
        file = join(homeDir, 'report.json')
        writeFileSync(file, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(JSON.stringify(REPORT), 'utf16le')]))
      })

      it('should read it', async () => {
        const { first } = await run(sceneDir, ['submit', '--file', file])
        assert.equal(first, 'queued')
      })
    })

    describe('and the report file is UTF-8 with a byte order mark', () => {
      let file

      beforeEach(() => {
        file = join(homeDir, 'report.json')
        writeFileSync(file, `﻿${JSON.stringify(REPORT)}`)
      })

      it('should read it', async () => {
        const { first } = await run(sceneDir, ['submit', '--file', file])
        assert.equal(first, 'queued')
      })
    })

    describe('and the report never arrives on stdin', () => {
      it('should give up within seconds with a usage error', async () => {
        const started = Date.now()
        const code = await new Promise(resolvePromise => {
          const child = spawn(process.execPath, [SCRIPT, 'submit', '--dir', sceneDir], {
            env: { ...process.env, HOME: homeDir, DCL_SDK_ISSUE_REPORTS: '', DCL_SDK_ISSUE_REPORTS_URL: '' },
            stdio: ['pipe', 'ignore', 'ignore']
          })
          child.on('exit', resolvePromise)
          setTimeout(() => child.kill(), 15_000)
        })
        assert.deepEqual({ code, fast: Date.now() - started < 10_000 }, { code: 2, fast: true })
      })
    })

    describe('and the service keeps failing on a report with a server error', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 500, json: {} }))
        await queueReports(sceneDir, 1)
      })

      afterEach(() => {
        mock.close()
      })

      it('should wait before retrying it rather than give it up within seconds', async () => {
        const env = { DCL_SDK_ISSUE_REPORTS_URL: mock.url }
        await run(sceneDir, ['check', '--fingerprint', 'another-issue'], { env })
        await waitForLedger(sceneDir, l => l.reports[0].failures === 1)
        for (let i = 0; i < 4; i++) await run(sceneDir, ['check', '--fingerprint', 'another-issue'], { env })
        await new Promise(resolveTimer => setTimeout(resolveTimer, 500))
        assert.deepEqual(
          { requests: mock.requests.length, status: readLedger(sceneDir).reports[0].status },
          { requests: 1, status: 'pending' }
        )
      })
    })

    describe('and the service keeps asking to wait', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 429, json: {}, headers: { 'Retry-After': '1' } }))
        await queueReports(sceneDir, 1)
      })

      afterEach(() => {
        mock.close()
      })

      it('should keep the report queued however many times it is tried', async () => {
        for (let i = 0; i < 7; i++) await flushWith(sceneDir, mock.url)
        assert.deepEqual(
          { requests: mock.requests.length, status: readLedger(sceneDir).reports[0].status },
          { requests: 7, status: 'pending' }
        )
      })
    })

    describe('and a report queued months ago meets a busy service on its first try', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 429, json: {}, headers: { 'Retry-After': '1' } }))
        await queueReports(sceneDir, 1)
        const ledger = readLedger(sceneDir)
        ledger.reports[0].createdAt = new Date(Date.now() - 90 * 86_400_000).toISOString()
        writeFileSync(join(sceneDir, '.dcl-sdk-reports.json'), JSON.stringify(ledger))
      })

      afterEach(() => {
        mock.close()
      })

      it('should keep it queued', async () => {
        await flushWith(sceneDir, mock.url)
        assert.equal(readLedger(sceneDir).reports[0].status, 'pending')
      })
    })

    describe('and a gateway in front of the service fails', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 502, raw: 'Bad Gateway' }))
        await queueReports(sceneDir, 1)
      })

      afterEach(() => {
        mock.close()
      })

      it('should back off without counting it against the report', async () => {
        await flushWith(sceneDir, mock.url)
        const ledger = readLedger(sceneDir)
        assert.deepEqual(
          { failures: ledger.reports[0].failures, backoff: Boolean(ledger.backoffUntil) },
          { failures: undefined, backoff: true }
        )
      })
    })

    describe('and the background backoff is dated years ahead', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 8 } }))
        await queueReports(sceneDir, 1)
        const ledger = readLedger(sceneDir)
        ledger.backoffUntil = '2099-01-01T00:00:00.000Z'
        writeFileSync(join(sceneDir, '.dcl-sdk-reports.json'), JSON.stringify(ledger))
      })

      afterEach(() => {
        mock.close()
      })

      it('should ignore it and send', async () => {
        await run(sceneDir, ['check', '--fingerprint', 'another-issue'], { env: { DCL_SDK_ISSUE_REPORTS_URL: mock.url } })
        const ledger = await waitForLedger(sceneDir, l => l.reports[0].status !== 'pending')
        assert.equal(ledger.reports[0].status, 'sent')
      })
    })

    describe('and a report was queued by an earlier version without today\'s protections', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 4 } }))
        const base = { status: 'pending', createdAt: new Date().toISOString(), title: 't' }
        const payload = {
          title: 'Old report',
          description: `Seed: ${'abandon ability able about above absent absorb abstract absurd abuse access accident'}`,
          kind: 'bug',
          sdkVersion: 'file:../../work/acme-client/sdk',
          metadata: { os: 'darwin', node: '20.0.0', agent: 'jane.doe@example.com' }
        }
        writeFileSync(
          join(sceneDir, '.dcl-sdk-reports.json'),
          JSON.stringify({
            consent: 'granted',
            reports: [
              { ...base, clientReportId: 'id-1', fingerprint: 'old-report', payload: { ...payload, clientReportId: 'id-1', fingerprint: 'old-report' } },
              {
                ...base,
                clientReportId: 'id-2',
                fingerprint: 'leak',
                payload: { ...payload, clientReportId: 'id-2', fingerprint: `leak-${'a1'.repeat(20)}` }
              }
            ]
          })
        )
      })

      afterEach(() => {
        mock.close()
      })

      it('should redact it again before sending, and not send one whose fingerprint carries a key', async () => {
        await flushWith(sceneDir, mock.url)
        const sent = JSON.stringify(mock.requests.map(request => request.body))
        assert.deepEqual(
          {
            requests: mock.requests.length,
            leaks: ['abandon ability', 'acme-client', 'jane.doe'].filter(part => sent.includes(part)),
            statuses: readLedger(sceneDir).reports.map(r => r.status)
          },
          { requests: 1, leaks: [], statuses: ['sent', 'rejected'] }
        )
      })
    })

    describe('and the description fills the body with multi-byte text', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 6 } }))
        await run(sceneDir, ['submit'], {
          input: { ...REPORT, description: '\u3042'.repeat(9990), workaround: 'Remount the Input with a new key.' }
        })
      })

      afterEach(() => {
        mock.close()
      })

      it('should shorten the description and keep the workaround whole', async () => {
        await flushWith(sceneDir, mock.url)
        assert.equal(mock.requests[0].body.workaround, 'Remount the Input with a new key.')
      })
    })

    describe('and the report arrives on stdin as UTF-16', () => {
      it('should read it', async () => {
        const raw = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(JSON.stringify(REPORT), 'utf16le')])
        const { first } = await run(sceneDir, ['submit'], { raw })
        assert.equal(first, 'queued')
      })
    })

    describe('and the report file is in the Windows ANSI encoding', () => {
      let file

      beforeEach(() => {
        file = join(homeDir, 'report.json')
        writeFileSync(file, Buffer.from(JSON.stringify({ ...REPORT, title: 'Caf\u00e9 sign does not render' }), 'latin1'))
      })

      it('should keep its accented letters', async () => {
        await run(sceneDir, ['submit', '--file', file])
        assert.equal(readLedger(sceneDir).reports[0].title, 'Caf\u00e9 sign does not render')
      })
    })

    describe('and a dead run left the send lock while another process is taking it over', () => {
      let mock

      beforeEach(async () => {
        mock = await startServer(() => ({ status: 201, json: { issueNumber: 1 } }))
        await queueReports(sceneDir, 1)
        writeFileSync(sendLockPath(sceneDir), JSON.stringify({ token: 'dead', pid: 2 ** 22 + 12345, at: Date.now() }))
        writeFileSync(`${sendLockPath(sceneDir)}.takeover`, '1')
      })

      afterEach(() => {
        mock.close()
      })

      it('should leave the takeover to that process', async () => {
        const { first } = await flushWith(sceneDir, mock.url)
        assert.deepEqual({ first, requests: mock.requests.length }, { first: 'busy', requests: 0 })
      })
    })

    describe('and reporting is disabled by the environment', () => {
      it('should report consent:denied', async () => {
        const { first } = await run(sceneDir, ['check', '--fingerprint', 'x'], { env: { DCL_SDK_ISSUE_REPORTS: 'off' } })
        assert.equal(first, 'consent:denied')
      })
    })
  })

  describe('when the scene files use CRLF line endings and already ignore the ledger', () => {
    beforeEach(async () => {
      writeFileSync(join(sceneDir, '.gitignore'), 'node_modules\r\n')
      writeFileSync(join(sceneDir, '.dclignore'), 'node_modules\r\n/.dcl-sdk-reports*\r\n')
      await run(sceneDir, ['consent', '--grant'])
    })

    it('should append in CRLF to .gitignore and leave .dclignore as it was', () => {
      assert.deepEqual(
        [readFileSync(join(sceneDir, '.gitignore'), 'utf8'), readFileSync(join(sceneDir, '.dclignore'), 'utf8')],
        ['node_modules\r\n.dcl-sdk-reports*\r\n', 'node_modules\r\n/.dcl-sdk-reports*\r\n']
      )
    })
  })

  describe('when the scene has a .dclignore without the ledger', () => {
    beforeEach(async () => {
      writeFileSync(join(sceneDir, '.dclignore'), 'node_modules')
      await run(sceneDir, ['consent', '--grant'])
    })

    it('should append the ledger to it', () => {
      assert.equal(readFileSync(join(sceneDir, '.dclignore'), 'utf8'), 'node_modules\n.dcl-sdk-reports*\n')
    })
  })

  describe('when the ledger file is not a ledger', () => {
    beforeEach(() => {
      writeFileSync(join(sceneDir, '.dcl-sdk-reports.json'), '[]')
    })

    it('should fail without replacing it', async () => {
      const { code } = await run(sceneDir, ['consent', '--grant'])
      assert.deepEqual(
        { code, content: readFileSync(join(sceneDir, '.dcl-sdk-reports.json'), 'utf8') },
        { code: 1, content: '[]' }
      )
    })
  })

  describe('when the ledger holds entries that are not reports', () => {
    beforeEach(() => {
      writeFileSync(join(sceneDir, '.dcl-sdk-reports.json'), JSON.stringify({ consent: 'granted', reports: [null, 3, {}] }))
    })

    it('should ignore them', async () => {
      const { first } = await run(sceneDir, ['check', '--fingerprint', REPORT.fingerprint])
      assert.equal(first, 'not-reported')
    })
  })

  describe('when the script is run through a symlink', () => {
    let link

    beforeEach(() => {
      link = join(homeDir, 'report.mjs')
      symlinkSync(SCRIPT, link)
    })

    it('should still run', async () => {
      const stdout = await new Promise(resolvePromise =>
        execFile(process.execPath, [link, 'status', '--dir', sceneDir], { env: { ...process.env, HOME: homeDir } }, (_err, out) =>
          resolvePromise(out)
        )
      )
      assert.equal(stdout.split('\n')[0], 'consent:unknown')
    })
  })

  describe('when .gitignore is read-only', () => {
    beforeEach(() => {
      chmodSync(join(sceneDir, '.gitignore'), 0o444)
    })

    it('should still record the answer, and say the ledger is not ignored', async () => {
      const { first, stdout } = await run(sceneDir, ['consent', '--grant'])
      assert.deepEqual({ first, warned: stdout.includes('add it by hand') }, { first: 'consent:granted', warned: true })
    })
  })

  describe('when several first runs record consent at once', () => {
    beforeEach(async () => {
      await Promise.all(Array.from({ length: 8 }, () => run(sceneDir, ['consent', '--grant'])))
    })

    it('should add the ignore line once', () => {
      assert.equal(readFileSync(join(sceneDir, '.gitignore'), 'utf8'), 'node_modules\n.dcl-sdk-reports*\n')
    })
  })

  describe('when the ledger starts with a byte order mark', () => {
    beforeEach(() => {
      writeFileSync(join(sceneDir, '.dcl-sdk-reports.json'), `\uFEFF${JSON.stringify({ consent: 'granted', reports: [] })}`)
    })

    it('should read it', async () => {
      const { first } = await run(sceneDir, ['check', '--fingerprint', REPORT.fingerprint])
      assert.equal(first, 'not-reported')
    })
  })

  describe('when the user denies consent', () => {
    beforeEach(async () => {
      await run(sceneDir, ['consent', '--deny'])
    })

    it('should report consent:denied on check', async () => {
      const { first } = await run(sceneDir, ['check', '--fingerprint', REPORT.fingerprint])
      assert.equal(first, 'consent:denied')
    })
  })

  describe('when the report is invalid', () => {
    it('should list every problem', () => {
      assert.deepEqual(validate({ title: 'x', description: 'y', kind: 'nope', fingerprint: 'Bad Slug', extra: 1 }), [
        'unknown field "extra"',
        '"kind" must be one of bug, limitation, docs-gap',
        '"fingerprint" must be a lowercase kebab-case slug, e.g. ui-input-controlled-reset'
      ])
    })

    it('should refuse a fingerprint or skill that carries a key or hash', () => {
      assert.deepEqual(validate({ ...REPORT, fingerprint: `leak-0x${'a'.repeat(64)}`, skill: 'f'.repeat(40) }), [
        '"fingerprint" looks like a key, hash or seed phrase; describe the area and symptom instead',
        '"skill" looks like a key, hash or seed phrase',
      ])
    })

    it('should refuse a hex key split into short slug segments', () => {
      assert.deepEqual(validate({ ...REPORT, fingerprint: ['a', 'b', 'c', 'd'].map(c => c.repeat(16)).join('-') }), [
        '"fingerprint" looks like a key, hash or seed phrase; describe the area and symptom instead',
      ])
    })

    it('should refuse a hex key broken up by a word, and a seed phrase written as a slug', () => {
      assert.deepEqual(
        [
          validate({ ...REPORT, fingerprint: `${'a'.repeat(16)}-zz-${'b'.repeat(16)}` }),
          validate({ ...REPORT, fingerprint: `${'abandon-'.repeat(11)}about` })
        ],
        [
          ['"fingerprint" looks like a key, hash or seed phrase; describe the area and symptom instead'],
          ['"fingerprint" looks like a key, hash or seed phrase; describe the area and symptom instead']
        ]
      )
    })

    it('should exit with code 2 on submit', async () => {
      await run(sceneDir, ['consent', '--grant'])
      const { code } = await run(sceneDir, ['submit'], { input: { ...REPORT, kind: 'nope' } })
      assert.equal(code, 2)
    })
  })

  describe('when redacting', () => {
    it('should strip paths, addresses, emails and tokens', () => {
      const text =
        'at /Users/jane/scene 0x1234567890123456789012345678901234567890 jane.doe@example.com ' +
        'Bearer abcdefghijklmnop https://api.example.com/x?token=sk-example123'
      assert.equal(
        redact(text, '/nowhere'),
        'at ~/scene <ADDRESS> <EMAIL> Bearer <TOKEN> https://api.example.com/x?token=<REDACTED>'
      )
    })

    it('should strip keys without 0x, file:// and WSL paths, credential pairs and npm tokens', () => {
      const hex = 'a'.repeat(64)
      const text = [
        `PRIVATE_KEY=${hex}`,
        'at file:///Users/jane/scene/x.ts',
        '/mnt/c/Users/jane/scene',
        'C:\\\\Users\\\\jane\\\\scene',
        '"apiKey": "abcd1234efgh5678"',
        "const authToken = 'abc123secret'",
        'npm_abcdefghijklmnopqrstuvwxyz0123456789',
      ].join('\n')
      assert.equal(
        redact(text, '/nowhere'),
        [
          'PRIVATE_KEY=<REDACTED>',
          'at file://~/scene/x.ts',
          '~/scene',
          '~\\\\scene',
          '"apiKey": "<REDACTED>"',
          "const authToken = '<REDACTED>'",
          '<TOKEN>',
        ].join('\n')
      )
    })

    it('should strip unquoted pairs, seed phrases, unterminated PEM keys, URL credentials and hex variants', () => {
      const hex = 'a'.repeat(64)
      const cases = [
        ['password=hunter2secret', 'password=<REDACTED>'],
        ['apiKey: abcd1234efgh', 'apiKey: <REDACTED>'],
        ['MNEMONIC="word1 word2 word3"', 'MNEMONIC="<REDACTED>"'],
        ['-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN', '<PRIVATE_KEY>'],
        ['postgres://admin:s3cret@db:5432/app', 'postgres://<REDACTED>@db:5432/app'],
        [`0X${'b'.repeat(64)}`, '<HEX_SECRET>'],
        [`KEY_${hex}`, 'KEY_<HEX_SECRET>'],
        ['"apiKey": "abc\\"leaked-part"', '"apiKey": "<REDACTED>"'],
        ['type Config = { apiKey: string }', 'type Config = { apiKey: string }'],
      ]
      assert.deepEqual(
        cases.map(([input]) => redact(input, '/nowhere')),
        cases.map(([, expected]) => expected)
      )
    })

    it('should redact adversarial input at the size limit within 50 ms each', () => {
      const inputs = [
        'auth-'.repeat(2000),
        'token-api-key-'.repeat(700),
        'A_KEY_'.repeat(1600),
        'a.'.repeat(5000),
        'a@b.'.repeat(2500),
        '/Users/' + 'a '.repeat(5000),
        '-----BEGIN ' + 'A '.repeat(5000),
        'a://a:'.repeat(1600),
        'password: '.repeat(1000),
        'secret="' + '\\'.repeat(5000),
        'AUTH_'.repeat(2000),
        'aToken'.repeat(1600),
        'Authorization: a '.repeat(580)
      ]
      const slow = inputs
        .map(input => {
          const started = performance.now()
          redact(input, '/nowhere')
          return [input.slice(0, 12), performance.now() - started]
        })
        .filter(([, ms]) => ms > 50)
      assert.deepEqual(slow, [])
    })

    it('should keep the Authorization scheme and redact its token', () => {
      assert.equal(
        redact('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456', '/nowhere'),
        'Authorization: Bearer <TOKEN>'
      )
    })

    it('should redact every Authorization scheme and credential names with infixes', () => {
      const cases = [
        ['authorization: bearer abcdefghijklmnopqrstuvwxyz123456', 'authorization: bearer <TOKEN>'],
        ['Authorization: Token abc123def456', 'Authorization: Token <TOKEN>'],
        ['"Authorization": "Bearer abcdefghij"', '"Authorization": "Bearer <TOKEN>"'],
        ['AUTH=dXNlcjpwYXNz', 'AUTH=<REDACTED>'],
        ['_auth=dXNlcjpwYXNz', '_auth=<REDACTED>'],
        ['GITHUB_TOKEN_V2=abc', 'GITHUB_TOKEN_V2=<REDACTED>'],
        ['AWS_ACCESS_KEY_ID=AKIAXXXX', 'AWS_ACCESS_KEY_ID=<REDACTED>'],
        ['SECRET_KEY_BASE=abc', 'SECRET_KEY_BASE=<REDACTED>'],
        ['tokenValue: abc123', 'tokenValue: <REDACTED>']
      ]
      assert.deepEqual(
        cases.map(([input]) => redact(input, '/nowhere')),
        cases.map(([, expected]) => expected)
      )
    })

    it('should leave words that only contain a credential keyword alone', () => {
      assert.equal(
        redact('author: jane, Tokenizer: fails, seedling: 3, auth: true, tokenCount: number', '/nowhere'),
        'author: jane, Tokenizer: fails, seedling: 3, auth: true, tokenCount: number'
      )
    })

    it('should strip a Windows scene path however it is spelled', () => {
      const root = 'D:\\Work\\AcmeCorp\\my-scene'
      const text = [
        'd:\\work\\acmecorp\\my-scene\\src\\index.ts',
        '/d/Work/AcmeCorp/my-scene/src',
        'D:\\\\Work\\\\AcmeCorp\\\\my-scene\\\\src',
        'D:/Work/AcmeCorp/my-scene/src'
      ].join('\n')
      assert.equal(redact(text, root).includes('AcmeCorp'), false)
    })

    it('should only strip the scene path where it ends', () => {
      assert.equal(redact('/srv/al/x and /srv/alice/y', '/srv/al'), '<SCENE>/x and /srv/alice/y')
    })

    it('should leave URL paths that merely contain /home alone', () => {
      assert.equal(redact('https://example.com/home/page', '/nowhere'), 'https://example.com/home/page')
    })
  })
})
