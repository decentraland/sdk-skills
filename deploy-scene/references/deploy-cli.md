# `sdk-commands deploy`: large uploads, flags, deployment API

Read this when a deploy uploads a large scene (50 MB or more), fails with a `DEPLOY_*` error code, or when you script, follow or cancel a deploy instead of watching the terminal. Applies to Genesis City and Worlds alike. Values below are from `@dcl/sdk-commands` **7.31.0** (`src/commands/deploy/`); older `sdk-commands` always upload in one request.

## How the upload is split

| Total size of the files to upload | What the CLI does |
| --- | --- |
| Under **50 MiB** | One request, as before. Batching a small scene is slower. |
| **50 MiB or more** | Batched upload (ADR-325, `POST /entities?partial=true`): **32 MiB** batches, **3** in flight at a time. A file is never split, so a file over 32 MiB raises the batch size to that file's size. Prints `Uploaded X MB of Y MB (batch n/N)`. |
| Server without batch support | Warns `The target server does not support batched uploads, uploading in a single request.` and falls back to one request, as long as the content the server is missing fits in **200 MB** (decimal). Over 200 MB it first asks the server which files it already has (`/available-content`) and counts only the missing ones. Still over → fails with `DEPLOY_PARTIAL_NOT_SUPPORTED`. |

- The 200 MB ceiling exists because the infrastructure in front of the content servers times out larger single requests. Batches stay far below it, so a large scene no longer times out on upload.
- Each request (single or batch) times out after **10 minutes**.
- Unchanged: every file must be ≤ **50 MB** (`SCENE_VALIDATIONS_MAX_FILE_SIZE_EXCEEDED`), and per-parcel / World storage limits still apply to the total.

## Flags

| Flag | Effect |
| --- | --- |
| `--target-content <url>` / `-tc` | Content server to deploy to. A scene with `worldConfiguration` needs this or `--target` (`https://worlds-content-server.decentraland.org`), else `DEPLOY_MISSING_TARGET_CONTENT`. Cannot be combined with `--target` |
| `--target <url>` / `-t` | Catalyst to deploy to (default `peer.decentraland.org`) |
| `--multi-scene` | Worlds: deploy alongside the World's other scenes. Without it, see *Worlds: undeploy first* below |
| `--yes` | Answers the CLI's confirmation prompts, including the one before deleting a World's other scenes |
| `--skip-build` | Upload the current `bin/` without rebuilding (normally `deploy` rebuilds with `--production`) |
| `--skip-validations` | Skip the client-side permission checks |
| `--no-browser` / `-b` | Don't open the linker page; open the printed URL yourself |
| `--port <n>` / `-p` | Port of the local linker server |
| `--https` | Serve the linker over HTTPS |
| `--deploy-token <token>` | Token that authorizes cancelling through the API (≥ 16 characters, else `DEPLOY_INVALID_ARGUMENTS`). Default: random per run. The linker URL carries it in its fragment (`#token=…`), which never reaches a server |
| `--programmatic` | For Node callers: `main()` returns `{ finish(), stop(), deployToken }` right after the linker starts instead of blocking |

## Deployment API (on the linker server)

The local linker server the CLI starts exposes the deployment as one resource, `/api/deploy`. The linker page (`@dcl/linker-dapp` 0.16.0) uses it to show upload progress and a **Cancel** button.

| Request | Result |
| --- | --- |
| `POST /api/deploy` (signed payload) | Starts the deploy. With `Prefer: respond-async` it answers **202** with the current state right away; **409** with the state whenever the phase is no longer `awaiting-signature` (a deploy already running, or already finished) |
| `GET /api/deploy` | State as JSON. With `Accept: text/event-stream`: server-sent `state` events, closed after a final phase (an `EventSource` client must `close()` then, or it reconnects) |
| `DELETE /api/deploy` + header `X-Deploy-Token: <token>` | Cancels. **403** without the right token; **409** once the deploy is final or while a World's old scenes are being removed; else **202** |

State: `{ phase, upload, result, error, cancelRequested }`.

- `phase`: `awaiting-signature` → `uploading` → (a World deploy without `--multi-scene` that has scenes to remove: `undeploying`, then `uploading` again) → one of the final phases `deployed`, `failed`, `cancelled`.
- `upload`: `{ stage: 'checking' | 'uploading' | 'processing', sentBytes, totalBytes, completedBatches, totalBatches }` (batch fields `null` for a single request); progress events are throttled to one per 250 ms.
- `result`: `{ entityId, message? }` once deployed. `error`: `{ code, message }`.

## Error codes

| Code | Meaning |
| --- | --- |
| `DEPLOY_PARTIAL_NOT_SUPPORTED` | Server can't take batches and the missing content is over 200 MB. Deploy to a server that supports batched uploads, or shrink the scene |
| `DEPLOY_CONTENT_CHECK_FAILED` | Couldn't ask the server which content it already has (30 s timeout) |
| `DEPLOY_CANCELLED` | Cancelled (prompt declined, or `DELETE /api/deploy`) and nothing was published |
| `DEPLOY_CANCELLED_AFTER_UNDEPLOY` | World deploy cancelled after the World's previous scenes were removed: the World can be left **empty**. Deploy again |
| `DEPLOY_CANCEL_OUTCOME_UNCERTAIN` | Cancelled during upload, and the CLI couldn't confirm whether the server published it. Check the scene before deploying again |
| `DEPLOY_MISSING_TARGET_CONTENT` | `worldConfiguration` set but neither `--target-content` nor `--target` |
| `DEPLOY_NO_PERMISSION` | Signing wallet has no deploy rights for that World (or those parcels) |
| `DEPLOY_DELETE_FAILED` | Removing the World's other scenes failed (hint: `--multi-scene`) |
| `DEPLOY_UPLOAD_FAILED` | Any other upload error |
| `DEPLOY_INVALID_ARGUMENTS` | `--target` together with `--target-content`, or a `--deploy-token` shorter than 16 characters |
| `DEPLOY_WORKSPACE_NOT_SUPPORTED` | Run from a workspace with several projects; deploy one scene project at a time |
| `DEPLOY_INVALID_PROJECT_TYPE` | The project is not a scene (a smart wearable, for example) |
| `DEPLOY_FAILED` | The API state's code for an error that has no code of its own |

## Worlds: undeploy first

Deploying to a World **without** `--multi-scene`, when the World has scenes on other parcels, lists them, warns `Deploying without --multi-scene will DELETE all existing scenes in world first.` and asks `Continue? (y/N)`. `--yes` answers that prompt, so a scripted deploy with `--yes` and no `--multi-scene` wipes every other scene in the World. The removal happens after signing, in the `undeploying` phase, before the upload; a cancel or failure after it leaves the World without those scenes.
