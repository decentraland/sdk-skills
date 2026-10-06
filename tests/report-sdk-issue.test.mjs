// Tests for report-sdk-issue/scripts/report.mjs. Run with: node --test tests/
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

function run(sceneDir, args, { input, env = {} } = {}) {
  return new Promise(resolvePromise => {
    const child = execFile(
      process.execPath,
      [SCRIPT, ...args, '--dir', sceneDir],
      { env: { ...process.env, DCL_SDK_ISSUE_REPORTS: '', DCL_SDK_ISSUE_REPORTS_URL: '', ...env } },
      (error, stdout) => resolvePromise({ code: error ? error.code : 0, stdout, first: stdout.split('\n')[0] })
    )
    child.stdin.end(input === undefined ? '' : JSON.stringify(input))
  })
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

// `respond` returning null leaves the request hanging, like an unresponsive service.
function startServer(respond) {
  const requests = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => (body += chunk))
    req.on('end', () => {
      const parsed = JSON.parse(body)
      requests.push({ method: req.method, url: req.url, body: parsed })
      const answer = respond(parsed, requests.length)
      if (!answer) return
      res.writeHead(answer.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(answer.json))
    })
  })
  return new Promise(resolvePromise =>
    server.listen(0, '127.0.0.1', () =>
      resolvePromise({
        server,
        requests,
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => {
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
    writeFileSync(join(sceneDir, 'scene.json'), '{}')
    writeFileSync(join(sceneDir, '.gitignore'), 'node_modules')
  })

  afterEach(() => {
    rmSync(sceneDir, { recursive: true, force: true })
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

    it('should add the ledger to .gitignore and .dclignore exactly once', async () => {
      await run(sceneDir, ['consent', '--grant'])
      assert.equal(readFileSync(join(sceneDir, '.gitignore'), 'utf8'), 'node_modules\n.dcl-sdk-reports.json\n')
      assert.equal(readFileSync(join(sceneDir, '.dclignore'), 'utf8'), '.dcl-sdk-reports.json\n')
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

      it('should keep the report queued and resend it with the same clientReportId after the next check', async () => {
        const env = { DCL_SDK_ISSUE_REPORTS_URL: mock.url }
        await run(sceneDir, ['submit'], { input: REPORT, env })
        await waitForLedger(sceneDir, l => Boolean(l.reports[0].lastError))
        await run(sceneDir, ['check', '--fingerprint', 'another-issue'], { env })
        const ledger = await waitForLedger(sceneDir, l => l.reports[0].status === 'sent')
        assert.deepEqual(
          { sameId: mock.requests[1].body.clientReportId === mock.requests[0].body.clientReportId, status: ledger.reports[0].status },
          { sameId: true, status: 'sent' }
        )
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
          { stdout: 'flushed\n1 sent, 0 rejected, 0 still queued.', status: 'sent' }
        )
      })
    })

    describe('and reporting is disabled by the environment', () => {
      it('should report consent:denied', async () => {
        const { first } = await run(sceneDir, ['check', '--fingerprint', 'x'], { env: { DCL_SDK_ISSUE_REPORTS: 'off' } })
        assert.equal(first, 'consent:denied')
      })
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
        '"fingerprint" looks like a key or hash; describe the area and symptom instead',
        '"skill" looks like a key or hash',
      ])
    })

    it('should refuse a hex key split into short slug segments', () => {
      assert.deepEqual(validate({ ...REPORT, fingerprint: ['a', 'b', 'c', 'd'].map(c => c.repeat(16)).join('-') }), [
        '"fingerprint" looks like a key or hash; describe the area and symptom instead',
      ])
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

    it('should leave URL paths that merely contain /home alone', () => {
      assert.equal(redact('https://example.com/home/page', '/nowhere'), 'https://example.com/home/page')
    })
  })
})
