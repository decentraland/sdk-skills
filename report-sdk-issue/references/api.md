# Reporting service contract

`scripts/report.mjs` sends reports to `POST <endpoint>/reports`. The service turns each report into an issue in a private GitHub repository the SDK team triages. This file is the contract the service implements; change both together.

The endpoint is the `DEFAULT_ENDPOINT` constant in `scripts/report.mjs`, overridable with `DCL_SDK_ISSUE_REPORTS_URL`. While it is `null`, reports are validated and kept in the ledger as `pending`.

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

The script has already redacted paths, addresses, emails, and tokens. The service applies its own redaction too.

## Responses

| Status | Body | Script behavior |
|---|---|---|
| `201` | `{ issueNumber, url }`: a new issue was created | Mark `sent` and store `issueNumber`. |
| `200` | `{ issueNumber, url, alreadyReported: true }`: this `clientReportId` was seen before | Mark `sent`. |
| `200` | `{ issueNumber, url, merged: true }`: an open issue with the same fingerprint exists; the report was added as a comment | Mark `sent`. |
| `400`, `413`, `422`, other 4xx | `{ error }` | Mark `rejected`; never retried. |
| `408`, `429`, `5xx`, network error, timeout | anything | Stay `pending`; retried on the next run with the same `clientReportId`. |

The service should send `Retry-After` with `429` and `503`. The script doesn't read it yet; it retries on the next `check` or `submit`.
