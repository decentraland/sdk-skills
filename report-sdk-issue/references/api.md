# Reporting service contract

`scripts/report.mjs` sends reports to `POST <endpoint>/reports`. The service turns each report into an issue in a private GitHub repository the SDK team triages. This file is the contract the service implements; change both together.

The endpoint is the `DEFAULT_ENDPOINT` constant in `scripts/report.mjs` (`https://sdk-issue-reports.decentraland.org`), overridable with `DCL_SDK_ISSUE_REPORTS_URL`. The override must be an https URL (http only on `localhost` or `127.0.0.1`). Setting it to `none`, `off` or empty, or to anything else, keeps reports validated and queued in the ledger as `pending` without sending them.

## Request

`POST /reports`, `Content-Type: application/json`, no authentication. The body is at most 32 KB. The service rejects unknown fields.

| Field | Type | Required | Notes |
|---|---|---|---|
| `clientReportId` | UUID string | yes | Generated once per report by the script and reused on every retry. The service must treat it as an idempotency key. |
| `title` | string ≤ 120 | yes | |
| `description` | string ≤ 10,000 | yes | Markdown. |
| `workaround` | string ≤ 5,000 | no | Markdown. |
| `kind` | `bug` \| `limitation` \| `docs-gap` | yes | |
| `fingerprint` | kebab-case slug ≤ 120 | yes | Stable across scenes and users; the service groups reports by it. |
| `skill` | kebab-case slug ≤ 80 | no | The sdk-skills skill the issue falls under. |
| `sdkVersion` | string ≤ 40 | no | Installed `@dcl/sdk` version, or the `package.json` range. |
| `metadata` | object | no | `{ os?: string, node?: string, agent?: string ≤ 40 }` |

The script has already redacted paths, addresses, emails, keys, credential pairs and tokens. The service applies its own redaction too, with the same patterns. `fingerprint` and `skill` are never redacted, because they become the issue footer and labels, so both sides refuse a slug whose hex-only segments add up to 32 or more characters (a key or hash, even split up) or that has more than 10 segments (a seed phrase).

The script never sends while the agent waits. `submit` queues the report and starts a detached background process that sends it; `check` starts that process only when reports are already queued. One process per scene sends at a time, least recently tried report first, until the queue is empty. It waits up to 30 seconds per request, above the service's 20-second budget for GitHub calls, so it does not give up on, and later resend, a report the service is still filing.

Before sending, the script fits the payload to the limits above after redaction (which can lengthen text): each field is cut to its limit, then the description and workaround are shortened until the JSON body is under 30,000 bytes. `sdkVersion` is sent only when it looks like a version or range (`1.2.3`, `^7.8.1`), never a `file:` path, URL or tarball.

## Responses

Redirects are not followed. A report counts as sent only on a `200` or `201` whose body is JSON with an integer `issueNumber`, so a captive portal, a proxy login page or a redirect never marks it sent.

| Status | Body | Script behavior |
|---|---|---|
| `201` | `{ issueNumber, url }`: a new issue was created | Mark `sent` and store `issueNumber`. |
| `200` | `{ issueNumber, url, alreadyReported: true }`: this `clientReportId` was seen before | Mark `sent`. |
| `200` | `{ issueNumber, url, merged: true }`: an open issue with the same fingerprint exists; the report was added as a comment | Mark `sent`. |
| `400`, `413`, `422`, any other 4xx not listed below | `{ error }` | Mark `rejected`; never retried. The fingerprint can be reported again. |
| `2xx` without the JSON above, `3xx`, `401`, `403`, `404`, `405`, `407`, `408`, `429`, `502`, `503`, `504`, `520`–`527`, `530`, network error, timeout | anything | The service was not reached or asked to wait. Stay `pending`, stop the run, and leave the service alone until `Retry-After` has passed (seconds or an HTTP date, held between 1 second and 24 hours), or 10 minutes without one. A `flush` run by hand ignores the wait. |
| Any other `5xx` | anything | May be this report's problem. Stay `pending`, wait 1 minute, then 5, 30 and 120 minutes before the next tries, and move on to the next report; two in a row are treated like a `503`. |

Only those other `5xx` answers count against the report. After 5, it is marked `failed` (given up), so one bad report never blocks the queue, and its fingerprint can be reported again. Not reaching the service, or being asked to wait, never counts; a report still unsent 30 days after its first try is given up too. Retries reuse the same `clientReportId`.

The script re-runs redaction and the checks above on a stored report right before sending it, so reports queued by an earlier version of the script get the current protections. A stored report whose `fingerprint` or `skill` no longer passes is marked `rejected` without being sent.
