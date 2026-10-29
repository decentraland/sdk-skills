---
name: creator-hub-mcp
description: "Edit a Decentraland scene's entities, components, Smart Items and scene settings live through the Creator Hub's MCP server instead of hand-editing assets/scene/main.composite. Use whenever a scene is open in the Creator Hub, whenever `mcp__creator-hub__*` tools (scene_state, create_entity, set_component, place_smart_item, …) are available in the session, when the user mentions the Creator Hub AI assistant or its MCP server, or before ANY edit to main.composite, main.crdt, or scene.json."
---

# Creator Hub MCP — live scene editing

The Creator Hub runs an MCP server inside the app (localhost, streamable HTTP, bearer token). Its tools read and mutate the scene that is **open in the editor**: changes apply to the live engine, show up in the viewport immediately, autosave to `assets/scene/main.composite`, and every one of them is a normal undo step for the user. The same server powers the Creator Hub's built-in AI assistant and can be exposed to any external MCP-capable tool.

Two ways you can be running:

| You are… | How the tools reach you |
| --- | --- |
| **Inside the Creator Hub's AI assistant** (Settings > AI > *Enable AI Assistant*; **on by default**) | Pre-wired. The app launches your `claude` / `codex` / `cursor-agent` / `gemini` CLI with the server registered as `creator-hub`, links these skills into the scene, and injects the same rules as this skill. Nothing to set up, for any of the four providers. |
| **In another tool** (Claude Code terminal or VS Code extension, Cursor, Codex, Claude Desktop, …) | Connect to the running Creator Hub — see [`reference/connect.md`](reference/connect.md). The user copies a JSON snippet from Settings > AI > *Expose AI assistant MCP server*. Skills are **not** wired up for you here — see [Where the skills come from](#where-the-skills-come-from). |

In Claude Code the tools appear as `mcp__creator-hub__<tool>`; inside the Creator Hub's assistant and in other clients they appear under their bare names (`scene_state`, `create_entity`, …). The connected tools are self-describing — treat the live catalog as authoritative over the table below.

### Files the user attaches to a prompt

Inside the Creator Hub's assistant the user can attach files to a turn: the **Attach files** paperclip left of the composer input opens a multi-select picker, files can be dropped onto the composer (overlay: *Drop files to attach*), and images can be pasted from the clipboard. Attachments appear as removable chips; **8 per prompt** is the cap. What this means for you:

- **A file picked or dropped from disk arrives as its real absolute path** — no copy, no base64 round-trip, no size cap. Read it in place; do **not** ask the user to re-paste its contents or to move it into the project. A pasted (clipboard) image has no path, so the app writes it to a temp file and hands you that path instead.
- **Any file type is accepted.** The app classifies it only for the chip icon: `image` (png, jpg, jpeg, gif, webp, bmp, svg, avif), `model` (glb, gltf), `audio` (mp3, wav, ogg, m4a, flac), `file` for everything else.
- **This is the natural way to hand over a reference image or a GLB.** A dropped `.glb` is a model the user wants in the scene: it is still outside the project, so copy it under `assets/Models/` before referencing it from `GltfContainer` (see **add-3d-models** for the bounding-box and collider audit). A reference image is usually art direction for a UI or material, not a file to import.
- A prompt may arrive with **attachments and no text at all** — the attachment is the request. Ask what to do with it rather than guessing.

### Assets the user mentions from the Local Assets panel

A second, different channel: **double-clicking an asset in the inspector's Local Assets panel** (tree or card) attaches it to the next prompt as a chip, next to the entity selection. Several assets plus the current selection can ride on one prompt; mentions clear after sending or when the chat closes. The asset arrives in the turn as `[Editor context]`, so:

- A mentioned **file** comes as a project-relative path that already exists in the scene — reference it directly, do not copy or re-import it.
- A mentioned **built-in avatar animation** comes as a *name*, not a path: there is no file to find. Play it with `triggerEmote({ predefinedEmote: '<name>' })` (see **avatar-animations**). Looking for a `.glb` for it is the failure mode this channel is designed to prevent.
- A chip is a pointer, not an instruction. "This one" plus a chip still needs a verb — ask if the request is ambiguous.

## RULE — the MCP is the way to change the scene graph; the file is the fallback

**Never write `assets/scene/main.composite`, `main.crdt`, or `scene.json` by hand while the Creator Hub MCP is available.** The rule, and why a hand edit to an open scene is silently lost, is **sdk-scenes** → *CRITICAL RULE — Editing an existing composite*. What the tools add on top:

- The tools do the bookkeeping the file workflow makes you do by hand: `inspector::Nodes` registration, `core-schema::Name`, `inspector::TransformConfig`, `entity-names.ts`, entity-id allocation, `jsonSchema` on non-core components.
- Every mutation is undoable by the user (Ctrl+Z / the assistant's *Undo AI changes* button). A file edit is not.

Decision ladder — pick the first row that matches:

1. **Tools present and answering** (`get_selection` or `get_scene_settings` returns — probe with an editor-routed tool, not `scene_state`, which answers `No scene is open.` from an external client even with the scene open; see Gotchas) → use them for every entity/component/settings change. Read the composite from disk only as a read-only cross-check.
2. **Tools present but failing** (`No editor window is open.`, connection refused, `401`) → the Creator Hub is closed, was restarted (URL and token rotate per launch), or no scene is open. Say so and ask the user to open the scene in the Creator Hub (or re-copy the connection snippet). Do not fall back to editing the file silently.
3. **Tools absent, but the user has the Creator Hub** → tell them the MCP is the safe route and point them at [`reference/connect.md`](reference/connect.md). Hand-edit the file only if they decline, and only with the scene closed in the Creator Hub (the **composites** skill's edit-mode rules then apply in full). If the scene is (or may be) open, stop and ask the user to choose: **sdk-scenes** → Agent Behavioral Guidelines, item 5 (the three options and the wording). The code fallback is always the user's pick, never yours, not even in a non-interactive session.
4. **No Creator Hub in play** (CLI-only project, CI) → the **composites** skill's file workflow applies.

What still lives in files and is yours to edit directly: `src/**` (scene code; saving triggers a rebuild automatically), `assets/Scripts/*.tsx` (script components — write the file, then `attach_script`), and asset files you add under `assets/Models/`, `assets/Images/`, etc.

**Static geometry goes in through these tools**: walls, floors, furniture and props, primitives or GLBs, via `create_entity` + `set_component` `MeshRenderer` / `GltfContainer`, or `place_smart_item`. This is **sdk-scenes** → *CRITICAL RULE — Composite-first scene authoring* applied through the MCP; without the MCP and with the scene open, ladder row 3 applies.

**A save is not proof the running bundle has your change.** The preview's dev server (`sdk-commands start`) watches `src/**` and rewrites `bin/index.js` on every save (`logic/bundle.ts` in `@dcl/sdk-commands`). A manual `sdk-commands build` while it runs writes the same file and the two race, and a save that lands mid-edit bundles half-written code (`SyntaxError`, scene unloads) — the one-write-per-change rule in **unity-explorer-mcp** applies. When something you changed does not show in-world, `grep` `bin/index.js` for a string literal from the edit before debugging the scene; if it is absent, touch the file and wait for the next `Bundle saved`. (Session 2026-10: an agent reported a change as done that the stale bundle never contained; the creator caught it.)

## RULE — search the catalog before manually building any standard object

Before creating an entity and manually assembling its components with `create_entity` + `set_component`, **always `search_catalog` first** to check whether a Smart Item already exists for the object. This applies especially to:

- **Lights** — the catalog has Spotlight and Point Light Smart Items (category `lights`) that bundle a real GLB model, a pre-configured `LightSource` component, and built-in Turn On / Turn Off / Toggle actions. Manually creating a `LightSource` entity misses the visual model, inspector integration, and action wiring.
- **Interactive furniture** — doors, chairs, platforms, chests, buttons, levers, etc. Newer script-based items: **Floor Pressure Button** (`buttons`, pressed while anyone stands on it, shared across players by default), **Button Pedestal** (`buttons`), **Lab Vault Door** / **Lab Capsule Door** (`doors`), **Lab Stair Platform** (`platforms`, piston), **Water Plane** / **Water Cylinder** (`materials`, splash where a player enters).
- **Media** — screens, image displays, NFT frames.
- **Triggers** — trigger areas, click triggers. The `utils` category has exactly **one** entry named **"Trigger Area"** (`e9fa0eab-44de-4efe-af77-a71171a1a73f`), a script-based item: an invisible box or sphere the user places and resizes, with a control that seeds the AI-assistant composer with a prompt describing what should happen on enter/leave. The older non-script item of the same name (`1ab2733f-1782-4521-9eda-6aa8ad684277`) and the interim label "Trigger Area (Script)" no longer exist; search for neither.

`place_smart_item` handles all the boilerplate that manual `set_component` calls miss:
- Downloads the item's GLB files and resolves `asset-packs::Placeholder` with the real on-disk path (e.g. `assets/asset-packs/spotlight/spotlight.glb`).
- Sets up `asset-packs::Script`, `asset-packs::Actions`, and `inspector::Config` components so the item works in the Creator Hub UI with configurable actions and triggers.
- Registers the entity in `inspector::Nodes` automatically.

**Only build manually** when no catalog item fits the requirement.

**Media the user already has: tell them to drag it from the Local Assets tab onto the viewport.** That is the fastest path, and it spawns a *catalog item* pointed at their file, not a bare component — so the entity arrives with the same component set and basic-view `inspector::Config` a hand-placed item has:

| Dropped file | Item spawned | What gets repointed |
| --- | --- | --- |
| `.png` / `.jpg` / `.jpeg` | **Image** (`37460a1e-affc-4f87-b725-118cc11d86fc`) | the `Material` PBR texture `src`; the plane is also lifted `+0.5 m` so it stands on the ground instead of being half-buried |
| `.mp3` / `.ogg` / `.wav` | **Ambient Sound - Forest Birds** (`5c8b4646-6ec0-41a0-8e9b-415a58728a9e`) | `AudioSource.audioClipUrl` |
| `.mp4` | **Video Screen** (`0201653b-bd38-48af-b9ef-a902a7e8bc9c`) | `VideoPlayer.src` **and** `asset-packs::VideoScreen.defaultURL` — the admin message bus re-seeds `src` from `defaultURL` at runtime, so setting only `src` is silently reverted |

The entity is named after the file with the extension stripped, de-duplicated against existing names, and the template's own placeholder media file is skipped on import. `.glb` / `.gltf` still drop as plain models. You can reproduce this through the tools (`place_smart_item` the same asset id, then `set_component` the field above), but the drag is one gesture for the user — prefer it when they are at the keyboard.

## Tool catalog

Names as registered on the `creator-hub` server (`packages/creator-hub/main/src/modules/scene-mcp.ts`).

| Group | Tool | What it does |
| --- | --- | --- |
| Read | `get_project_info` | scene.json metadata (name, parcels, base, spawn points), SDK version, dependencies. Use it for Step 0 bounds. |
| Read | `scene_state` | Roster of authored entities: id, name, kind, world transform, component list, GLTF src, Smart-Item flag. Truncated to the first 200 entities. |
| Read | `entity_detail` | Every component value on one entity, by id or Name. Call it to learn a component's exact shape before `set_component`. |
| Read | `get_selection` | Entities currently selected in the editor. Resolve "this" / "the selected one" with it before acting. **The Scene root is never reported**: with only the root selected the result is empty, exactly as with nothing selected — so an empty result does not mean the user has deselected everything, and "this" may still refer to the scene as a whole. Player and Camera are reported normally. |
| Read | `get_scene_metrics` | Live budget (triangles, entities, bodies, materials, textures) vs per-scene limits, plus entities out of bounds. |
| Read | `editor_screenshot` | Image of the editor viewport (no preview needed). |
| Mutate | `create_entity` | New entity, optional `name` and `parent` id. Returns the id. |
| Mutate | `remove_entity` | Deletes an entity and its children. |
| Mutate | `set_parent` | Reparents (world position preserved). `parent: 0` = scene root. |
| Mutate | `set_component` | Create or update a component. `component` accepts short (`Transform`) or full (`core::GltfContainer`) names; `value` is the same JSON the composite stores. On update the keys you pass are **merged**. |
| Mutate | `remove_component` | Removes a component by name. |
| Assets | `search_catalog` | Search the Creator Hub asset-packs catalog by name/category/tag. Despite the name it covers **static items as well as Smart Items**. Omit `query` to list everything. Categories include `buildings` (whole buildings, listed after `structures`) and `materials` (the Water Plane / Water Cylinder items), and the **Avatar Animations** pack (45 `_emote.glb` clips + the 32 built-in emote names) — file-only assets, see `place_smart_item`. The same additions are catalogued offline in **add-3d-models** → `references/asset-pack-catalog.md` and **avatar-animations** → `references/animation-catalog.md`. **Name, category, tags and caption are generated metadata, not a preview:** `search_catalog` for "man" returns **Human** (`decorations`, tags `man, person, figure, humanoid…`, caption "Human figure in mid-action"), whose GLB is the word *HUMAN* in 3D letters (`packs/cyberpunk/assets/human/Word_Human.glb`, creator-hub `origin/main` 2026-10-19; placed as a character in a 2026-10-12 session). Before placing an item you have not seen, look at its `thumbnail.png` — next to its `data.json` under `assets/asset-packs/<pkg>/` once downloaded, or in the creator-hub repo under `packages/asset-packs/packs/<pack>/assets/<item>/` — or run the bounding-box audit from **add-3d-models** on the GLB. |
| Assets | `place_smart_item` | Place a catalog item by `assetId` at a world `position` (default 8,0,8). Downloads the item's files into `assets/asset-packs/<pkg>/` and spawns it — Smart Items arrive with their behaviour. Most items now arrive as `asset-packs::Script` code (no `Triggers`); configure them through the Script's params, and wire "When X" hooks via their optional `ActionCallback` params. See **script-components**. **Rejects file-only assets** (the Avatar Animations pack — there is no entity to place): for a built-in emote the error names the `triggerEmote({ predefinedEmote })` call to use; for a clip, ask the user to drag the card onto the viewport (adds the file under `assets/asset-packs/<pkg>/`, no entity) or download it per **avatar-animations** → `references/animation-catalog.md`, then play it with `triggerSceneEmote` from code. |
| Scripts | `attach_script` | Adds an `asset-packs::Script` component pointing at a file. **Write the file first** (under `assets/Scripts/`), then call this. Optional `priority`. |
| Settings | `get_scene_settings` / `set_scene_settings` | Read / change scene.json fields (name, description, categories, tags, age rating, spawn points, skybox, terrain, `layout.parcels`, flags). Each passed field replaces the current one wholesale — read first. **Never pass `spawnPoints` to it**: its input takes the `scene.json` shape, which lands unconverted in the metadata component and either kills the data layer or writes `"position": {}` into `scene.json` — write spawn points with `set_component` on entity `0` instead, see the data-layer rule below. `thumbnail` is **not** in this tool's input schema (a `thumbnail` key is silently dropped) — set it with `set_component` on entity `0`'s `inspector::SceneMetadata-v*`, or in the editor's **Scene settings → Thumbnail**, and never write a cover to `assets/Images/autogenerated-thumbnail.png`: see Gotchas. |
| Preview | `launch_preview`, `preview_status`, `stop_preview` | Start / poll / stop the scene in the Decentraland Explorer with its MCP server on. |
| Preview | `explorer_<name>` (dynamic), `explorer_call` | While a preview runs, the Explorer's runtime tools (`explorer_screenshot`, `explorer_walk`, `explorer_click_entity`, `explorer_get_scene_logs`, …) are registered live; `explorer_call(tool, arguments)` is the fallback if they haven't appeared yet. |
| Chat | `ask_user` | Blocks on a question shown in the Creator Hub chat. Only meaningful inside the embedded assistant. **Times out after 10 minutes** with no answer and resolves as a dismissal. On timeout the prompt is also **closed in the chat** ("This question is no longer active.") and any answer arriving afterwards is **discarded** — a timed-out `ask_user` can never be answered retroactively. Never block a turn on it if the creator may have stepped away; put the question in your final message instead. |

## Workflow

**Read before you write.** `get_project_info` for parcels (compute bounds exactly as in the **composites** skill Step 0 — the tools do not stop you from placing entities outside the scene, and `get_scene_metrics` is a weaker safety net than it looks — see the Bevy-renderer gotcha below). `scene_state` to see what exists and avoid duplicate names. `get_selection` whenever the user's request refers to what they have selected.

**Adding a model.**

- *Catalog item* → `search_catalog` then `place_smart_item`. Files land in `assets/asset-packs/<pkg>/` automatically.
- *Architecture* (rooms, corridors, doorways, anything the avatar walks through or into) → size the envelope for the **third-person camera** before placing; realistic dimensions read cramped in-world. The dimensions are in **add-3d-models** → "RULE: Scale interiors up for the third-person camera".
- *Model the user already has, or one you authored* → put the GLB under `assets/Models/` (see the **add-3d-models** skill for Blender authoring and the bounding-box audit), then `create_entity` (with a `name`), `set_component` `Transform` (`{position:{x,y,z}, rotation:{x,y,z,w}, scale:{x,y,z}}`), and `set_component` `core::GltfContainer` (`{src, visibleMeshesCollisionMask, invisibleMeshesCollisionMask}` — mask rules and the animation/collider checks from **add-3d-models** still apply; add `core::Animator` when the GLB has clips).
- *Lights* → `search_catalog` with category `lights` to find Spotlight and Point Light Smart Items, then `place_smart_item`. These include the light model, `LightSource`, and toggle actions. Only create a bare `LightSource` entity manually when you need an invisible light source or non-standard parameters -- see **lighting-environment** for the full `LightSource` API and the Smart Item rule.
- *Behaviour on it* → a Smart Item if one fits (`search_catalog` first), otherwise write a script under `assets/Scripts/` and `attach_script` (rules in **script-components**), or reference the entity by name from `src/` code (`engine.getEntityOrNullByName`).

**Component shapes.** `set_component` validates against the real schema. Before your first write of a component type, `entity_detail` on any entity that already has it — or read its entry in the **composites** format catalog. For `asset-packs::Script`, params are positional inside `layout` (see **script-components**); prefer `attach_script` and let the editor build the layout.

**After writing.** Read-after-write is safe *while the data layer is alive* — the server waits for the autosave before returning from a mutation, so a following `scene_state` is fresh. It stops being safe the moment that process dies (next rule), which is why the check below is on disk and not on a tool answer. Check `get_scene_metrics` when you added geometry. `editor_screenshot` shows the result without a preview; `launch_preview` + `explorer_*` when you need the running scene (walk, click, logs, FPS). The iteration loop, camera framing, and performance references in the **unity-explorer-mcp** skill apply to the `explorer_*` tools unchanged — skip that skill's Setup section (no `claude mcp add`, no bind gate) because the tools arrive through the `creator-hub` server. When done, leave the camera in the scene's intended retail mode (third person unless the scene forces first person) and `stop_preview` if you launched it only to check.

**If you have no runtime view, say so once and label what you cannot see.** From an external client the `explorer_*` tools never appear, and the **unity-explorer-mcp** server refusing its connection just means the Explorer is not running (that skill's Setup launches it). Offer to set it up; until a screenshot or the creator confirms a visual result, report it as unverified ("the screen plane should now sit inside the bezel — I have not seen it"), never as done. Two sessions on one scene (2026-10) delivered every visual defect — a screen floating in front of its monitor, a door clipping its frame, z-fighting walls, white materials — to the owner first, because fixes were reported on the strength of the code alone.

**Never pin an editor entity's placement from code.** Scene code that writes the `Transform` of an entity the editor owns — on every load, to "correct" where it sits — silently overrides every move the creator then makes in the Hub: they dragged a tray onto a belt and it kept reappearing 2 m away in mid-air (owner-reported symptom, cause read in the scene's own code, 2026-10-11). Code may **read** an editor entity's `Transform`; if it needs placement of its own, give it its own entity.

**Transforms on nested entities are parent-local.** An entity the Hub nests under a group reports `Transform.position` relative to that group, not to the scene, so resolve the parent chain before using a position for a distance check or to place something beside it (read in `assets/scene/main.composite`, 2026-10-11 — harmless in that scene only because the groups sat at the origin).

**Mistakes.** Undo is the user's — tell them what to undo, or `remove_entity` / `set_component` back to the previous value. Never "repair" a mistake by editing `main.composite`.

## RULE — confirm a batch landed on disk; the data layer can die silently

The thing that holds the editor's engine and writes `assets/scene/main.composite` is the **@dcl/inspector data layer**. Under the **Bevy** renderer it runs in a separate child process (`sdk-commands start … --data-layer`, from the scene's own `node_modules`); under Babylon it runs inside the inspector iframe. The Electron main process never writes the composite (process details: [`reference/internals.md`](reference/internals.md) → Data layer process).

When that data layer dies, the MCP server in the Electron app stays up and **keeps answering every call as if nothing were wrong**. Nothing in a tool result tells you the scene stopped changing.

**So after every batch of mutations, check the file, not the tool:** `assets/scene/main.composite`'s modification time must have advanced (`ls -l`/`stat`). An unchanged mtime across a batch means the edits exist only in a process that is gone.

```bash
stat -f '%m %N' "assets/scene/main.composite"   # macOS; coreutils: stat -c '%Y %n'
```

```powershell
(Get-Item "assets\scene\main.composite").LastWriteTime   # Windows (PowerShell)
```

**Observed symptoms of a dead data layer** (2026-10-08 session; check these when the mtime is stale):

- `set_component`, `create_entity`, `place_smart_item` and friends all still return success.
- `scene_state` / `entity_detail` keep returning the **pre-crash** values — a read-back "confirming" your write is confirming the old snapshot.
- `editor_screenshot` returns a blank image.
- `get_scene_metrics` returned all zeros with an empty `entitiesOutOfBoundaries` — **but do not use that as the tell** — under the Bevy renderer those fields are hardcoded zeros anyway (see Gotchas). The mtime check is the reliable one.

**Recovery is the user's, and your in-memory edits are lost.** There is no tool that restarts the data layer. Stop writing, look at the Creator Hub main log (macOS: `~/Library/Logs/creator-hub/main.log`; Windows: `%APPDATA%\creator-hub\logs\main.log`) for an `Exiting "sdk-commands start … --data-layer" … exit code=1` line — `grep -n "exit code=1\|reading 'deserialize'" main.log`, not a skim: the 2026-10-08 session had the crash line inside a 241 KB grep result and read only the first 2 KB of it — tell the creator to **close and reopen the scene** in the Creator Hub, then **re-apply every mutation made since the crash** — compare against the composite on disk to find where the truth stops. Leaving the editor page also kills that scene's preview server (`handleBack` → `killPreview` in the Hub's `EditorPage`), so after the reopen the creator presses **Play** again — or you call `launch_preview` again — before expecting anything new in-world.

**Never write spawn points with `set_scene_settings`.** Its `spawnPoints` input takes `scene.json`-shaped positions and the editor stores them unconverted in a `$case` union, so the write either kills the data layer or writes `"position": {}` to `scene.json`, for point and range values alike (mechanism: [`reference/internals.md`](reference/internals.md) → Spawn points through `set_scene_settings`).

**So: write spawn points with `set_component` on entity `0`, in the component's own shape** — the same route as the thumbnail in Gotchas; take the versioned component name from `entity_detail(0)` and pass only the `spawnPoints` key:

```json
{"spawnPoints": [{"name": "spawn", "default": true,
  "position": {"x": {"$case": "single", "value": 8}, "y": {"$case": "single", "value": 0}, "z": {"$case": "single", "value": 8}},
  "cameraTarget": {"x": 8, "y": 1, "z": 12}}]}
```

A ranged axis is `{"$case": "range", "value": [4, 12]}`. Then read `scene.json` back (it follows on the next autosave) and check every `spawnPoints[].position` holds numbers. If it came out as `{}`, close the scene in the Hub and fix `scene.json` by hand: on the next open the data layer re-seeds the scene metadata from `scene.json`, so the hand edit wins — the same holds for any other scene setting edited with the scene closed. The shape mismatch is a Hub bug; report it with **report-sdk-issue**.

## Preview lifecycle — `stop_preview` does not close the Explorer

**`stop_preview` never closes the Explorer — by design, and there is no tool that does.** It kills only the `sdk-commands start` dev-server child and answers `{ok: true}`; the Explorer app was handed to the OS through a `decentraland://` deep link, so it sits outside that process tree and nothing in the Creator Hub kills it (mechanism: [`reference/internals.md`](reference/internals.md) → Preview lifecycle).

`preview_status` does not notice, either: `running` reflects the dev-server handle, not a probe of the Explorer or its port. So "no preview running" is a statement about the dev server, never about the app.

The next `launch_preview` then fails: each launch passes a fresh MCP port, and the single-instance desktop Explorer hands the new deep link to the window already open, which keeps its old port. After ~45 s of retries the Hub returns:

> The preview launched but its MCP server never answered. The Explorer may still be starting, or this build has no MCP support. (TypeError: fetch failed)

and — note — that failure path **also kills the dev server it just started**, leaving the Explorer orphaned on a dead realm. (Related: `preview_status` can block up to **90 s** polling an Explorer that is up but not ready, so a long hang there is not a crash.)

**`Tool call interrupted: the session ended…` on `launch_preview` / `preview_status` is the creator stopping the turn, not a preview failure.** Both tools block for a long time (the launch retries the Explorer's MCP for ~45 s, the status poll up to 90 s); inside the embedded assistant the chat's stop control kills the CLI child meanwhile (`aiStop` → `killTree`, `main/src/modules/ai.ts`), and the tool call reports itself interrupted. Four such interruptions in one session (2026-10-08) each coincided with the creator's next message, and the preview the agent had launched was running the whole time. Before concluding anything, `pgrep` the Explorer and read the log — and do not write "`launch_preview` ends the session" into the project's notes, as that session did.

**Rule — before `launch_preview`, check both the tool and the OS:**

```bash
pgrep -fl '[M]acOS/Explorer'    # the Explorer app itself
pgrep -fl '[d]cl_watchdog'      # its watchdog, from /Applications/Decentraland.app
```

Keep the brackets in these patterns. `pgrep -f` / `pkill -f` match against every process's full command line, and many agent shell tools run commands as `bash -c "<command>"`, so a plain pattern also matches the wrapper shell: the check reports a live Explorer that isn't there, and `pkill` kills the shell running it. `[d]cl_watchdog` still matches the real process, but never the command text itself.

**The inverse also happens: the creator closes the Explorer window and `preview_status` keeps reporting `running: true`.** The sdk-commands child is still alive, so the handle still says yes, while every `explorer_*` call fails with `fetch failed` (observed 2026-10-12). A string of `fetch failed` results therefore means "the app is gone", not "the scene is broken" — confirm with `pgrep -fl '[M]acOS/Explorer'`, then `stop_preview` followed by one `launch_preview` to recover. In both directions the rule is the same: **`pgrep` is the only reliable answer to "is the Explorer running"**.

`preview_status` saying "not running" is **not** evidence the Explorer is closed. If either process is alive and you need a clean preview, close the stale instance, **confirm it exited**, then `launch_preview` **once**:

```bash
pkill -f '[d]cl_watchdog'; pkill -f '[D]ecentraland.app/Contents/MacOS/Explorer'
for i in $(seq 1 30); do pgrep -f '[M]acOS/Explorer' >/dev/null || break; sleep 1; done   # wait up to 30 s
```

On **Windows** the Explorer is `Decentraland.exe` and the watchdog `dcl_watchdog.exe`. In PowerShell (matching by process name, so the check never matches the shell running it):

```powershell
Get-Process Decentraland, dcl_watchdog -ErrorAction SilentlyContinue        # is either alive?
Stop-Process -Name dcl_watchdog -Force -ErrorAction SilentlyContinue        # watchdog first: it reacts to a non-zero Explorer exit
Stop-Process -Name Decentraland -Force -ErrorAction SilentlyContinue
Wait-Process -Name Decentraland -Timeout 30 -ErrorAction SilentlyContinue   # confirm it exited
```

**That Explorer window is the creator's, not a test rig.** Everything you drive through the `explorer_*` tools — `explorer_move_to`, `explorer_reload_scene`, camera-mode changes, and any asset-file churn that triggers a hot reload — lands in the session they are playing. Check `explorer_get_player_state` and recent `explorer_get_scene_logs` for activity before taking the controls, prefer `explorer_set_camera_pose` over `explorer_move_to` for a look-check, and restore the camera mode you found. Full rule in the **unity-explorer-mcp** skill's iteration loop (observed 2026-10-10).

Connected first try on both attempts after that. Prefer reusing a healthy running preview (hot reload + `explorer_reload_scene`) over restarting — only kill when it is stale or the MCP never answered. **When the user owns that Explorer window, ask before killing it.**

**A re-baked GLB can keep rendering its old contents in a running preview.** The dev server serves current bytes; the staleness is in the Explorer's own asset cache (analysis: [`reference/internals.md`](reference/internals.md) → Re-baked GLB staleness). GLBs added or renamed after `launch_preview` can be missing in-world until `explorer_reload_scene` or a full preview restart, and a GLB **overwritten in place under the same name** can keep showing the old mesh. `src/` hot reload is unaffected. Practical rule: after re-baking a model, export it under a **new file name** and repoint `GltfContainer.src` — that is the form that reloaded reliably; otherwise `explorer_reload_scene` and, if the old mesh persists, restart the preview. (Symptom: the mesh you just exported is absent or visibly stale while `explorer_get_scene_logs` shows no load error. Also check `.dclignore` — an ignored path is never served at all.)

## Where the skills come from

How these skills reach the agent depends on which of the two setups above you are in.

**Inside the Creator Hub's AI assistant the app installs them — never hand-copy them.** The installer lives in `packages/creator-hub/main/src/modules/skills.ts`:

- It downloads `decentraland/sdk-skills` **main** into a per-user cache (keyed on the upstream commit SHA plus the app version, swapped atomically, tolerant of being offline).
- It **symlinks** that cache into the open scene as **`.claude/skills`** and **`.agents/skills`**. Links the app created are added to a `.gitignore`. If the user already has a real `skills` directory, it links each skill in individually and skips names the user already owns.

In that setup, do not copy skill directories into the scene and do not tell the user to: a hand-placed copy shadows the managed symlink and then silently goes stale; the app is the updater.

**From an external client (Claude Code CLI or VS Code extension, Cursor, Codex, Claude Desktop, …) the skills are the user's to install.** The MCP snippet only connects the tools; it does not bring the skills along. Two cases:

- If the Creator Hub currently has the scene open, the app-managed `.claude/skills` / `.agents/skills` symlinks already exist in the scene folder, so a Claude Code session started **in that folder** picks them up. Do not duplicate them.
- Otherwise (a different working directory, the scene not open in the Creator Hub, or a client that reads skills from elsewhere), install them the normal way, from the scene folder or the user's skills root:

  ```bash
  npx skills add decentraland/sdk-skills --all
  ```

  Re-run the same command to update; `npx skills update` only refreshes skills already present and misses newly added ones. See the repo [README](../README.md) for per-skill installs.

**The app-linked set is the denylisted one.** A Claude Code session in a Hub-linked folder therefore has **no `deploy-scene` / `deploy-worlds`** (a 2026-10 session web-searched the Worlds deploy command and hand-wrote `worldConfiguration` instead). Install them for the user, not into the symlinked folder — `npx skills add decentraland/sdk-skills --skill deploy-worlds -g` (user-level) — or follow the short path: add `worldConfiguration.name` to `scene.json`, then `npx @dcl/sdk-commands deploy --target-content https://worlds-content-server.decentraland.org`; thumbnails, the two name/description/thumbnail sets and the error table are in **deploy-worlds**.

**Four skills are deliberately denylisted inside the Creator Hub agent:** `create-scene`, `deploy-scene`, `deploy-worlds`, `migrate-sdk6-to-sdk7`. The Creator Hub owns scaffolding and publishing through its own UI, and it is SDK7-only. The installer handles them in two ways:

- A denylisted skill that has supporting files (`create-scene`, `migrate-sdk6-to-sdk7`) ships **without its `SKILL.md`** — its `references/` stay resolvable from other skills' relative paths, but the skill itself can never trigger.
- A denylisted skill whose directory holds **nothing but `SKILL.md`** (`deploy-scene`, `deploy-worlds`) is **skipped entirely**.

If a user inside the Creator Hub asks to scaffold a project or publish, point them at the app's own flow rather than trying to load or reconstruct those skills. A manual `npx skills add` install from an external client is not denylisted: all four skills are available there.

## Gotchas

Source references behind these gotchas: [`reference/internals.md`](reference/internals.md) → Gotcha sources.

- **URL and token rotate on every Creator Hub launch.** A config that worked yesterday gives `ECONNREFUSED` or `401` today; the fix is re-copying the snippet from Settings, not retrying.
- **One open project at a time.** The server operates on the scene open in the single editor window. Mutation tools answer `No editor window is open.` when the user is on the scene list.
- **Disk-read tools and `launch_preview` say `No scene is open.` from an external client** even though the scene is visibly open: the project directory is bound to `get_project_info` / `scene_state` / `entity_detail` / `launch_preview` only when the *embedded* assistant starts a turn. Everything routed through the editor (`get_selection`, `get_scene_metrics`, `get_scene_settings`, all mutations, `place_smart_item`) works regardless. So from an external client: prove access with `get_selection` / `get_scene_settings` or one harmless mutation plus the composite mtime check above — never with the disk-read tools; read `scene.json` and `assets/scene/main.composite` from disk **read-only** for the roster; mutate through the tools; and for an in-world check launch the preview from the Hub's **Play** button with **Enable MCP Server** ticked and drive it per **unity-explorer-mcp** (its Setup section applies on this path — the `explorer_*` tools never appear, since nothing arrives through the `creator-hub` server).
- **Read tools trail the engine by one autosave** (~100 ms). The mutation tools already wait it out; only matters if the user is dragging things while you read.
- **`Scene RPC "<tool>" timed out (no renderer response)` is the Hub's 5 s editor-RPC timeout**, not a crash: the inspector did not answer in time. Seen on `create_entity` while the Bevy editor was in **Play**; the calls succeeded once Play was stopped. Ask the creator to stop Play before a batch of mutations, then retry — do not fall back to editing the file.
- **`scene_state` caps at 200 entities.** For big scenes filter by name via `entity_detail` or read the composite from disk.
- **The Explorer `--mcp` preview checkbox is a different server.** *Enable MCP Server* lives in the **Play Options** popover (the dropdown arrow on the editor header's **Play** button), in the flyout that opens when you hover the **Desktop Client** row. It launches the Explorer with its own MCP on port 8123 (the **unity-explorer-mcp** skill) and is **only shown when the project is on `@dcl/sdk` 7.25.0 or later** — if the user cannot find the checkbox, check the scene's SDK version before debugging the Hub. The Creator Hub MCP described here is the editor's server; inside the embedded assistant use its `launch_preview` instead of that checkbox. From an external client `launch_preview` fails (see the `No scene is open.` gotcha above), so there the checkbox *is* the route.
- **One Ctrl+Z = one of your operations, not one component write.** A whole synchronous change burst commits as a single undo transaction: a multi-entity op — placing a composite Smart Item, a scripted item with children — is one entry, and undoing an add removes the entity from the Bevy viewport too. Still describe your changes to the user in the units they will undo them in.
- **Scene audio can be muted in the editor, but only under Bevy.** The viewport toolbar has a speaker toggle (*Mute scene audio* / *Unmute scene audio*) that forwards every `AudioSource` / `AudioStream` to the renderer at volume 0; the state survives a reload. It is absent under the Babylon renderer, which does not play scene audio at all. So "I can't hear the sound you added" is not evidence the component is wrong — check the renderer and the toggle first, and note that an authored `volume` is not what the Bevy viewport is playing while mute is on.
- **`get_scene_metrics` reports nothing useful under the Bevy renderer.** Under Bevy it returns hardcoded zeros for triangles, bodies, materials and textures, and an empty out-of-bounds list. The limits are still real, and `entities` is derived from the Nodes tree rather than the renderer, but **all-zero content metrics and an empty `entitiesOutOfBoundaries` mean "Bevy", not "empty scene" and not "problem"** — do not read a budget or an out-of-bounds verdict out of them. Under Babylon they are real: each entity's **bounding mesh** is tested against the layout, so it does catch oversized geometry there. For a trustworthy budget either way, `launch_preview` and use `explorer_get_scene_content_stats`.
- **Never save a custom thumbnail as `assets/Images/autogenerated-thumbnail.png`.** The Hub captures the viewport into that one fixed path, overwriting whatever file is there, every time it auto-generates a thumbnail — when a publish starts and when it refreshes the project card, so a cover written there is replaced right before the upload. It only rewrites `scene.json`'s `display.navmapThumbnail` in three cases: the entry is **unset**, the file it points at is **missing**, or it names the **autogenerated path with different casing**. A miscased *custom* cover is left alone — macOS and Windows resolve it, so it only fails at deploy. That is why the overwrite is silent. Save custom covers under a distinct name (e.g. `assets/Images/cover.png`) and repoint the scene at it.
- **Image assets live in `assets/Images/` with a capital I, and the casing is load-bearing at deploy time.** The deploy file list keeps the on-disk casing and the Catalyst matches `display.navmapThumbnail` against it **case-sensitively**, so a scene.json saying `assets/images/...` while the folder on disk is `assets/Images/` publishes with `Scene thumbnail 'assets/images/autogenerated-thumbnail.png' must be a file included in the deployment`. Nothing local notices: macOS and Windows resolve either casing, so the scene looks fine until the upload. The Hub writes its autogenerated thumbnail to `assets/Images/` by default — keeping an existing folder that differs only in case, so a project that already has `assets/images/` stays lowercase — and rewrites a miscased *autogenerated* `navmapThumbnail` entry on the next thumbnail save — but **anything you write by hand must match the folder that is actually there**. Check with `ls assets` before setting the path, and never create a second folder that differs only in case. `set_scene_settings` cannot (no `thumbnail` key in its input schema; the MCP SDK strips unknown keys before the editor sees them), but `set_component` can: `entity_detail(0)` to read the root entity's scene-metadata component, then `set_component(0, "inspector::SceneMetadata-v5", {thumbnail: "assets/Images/cover.png"})` — keys merge as in any update, and `scene.json`'s `display.navmapThumbnail` follows on the next autosave (verified live; 106 parcels and the spawn points survived). Take the exact versioned name from that read instead of hardcoding `-v5`: the editor binds to whichever version carries data, so a scene on an older pinned `sdk-commands` is still on `-v4`, and writing the wrong version just adds a component nobody reads. The editor's **Scene settings → Thumbnail** field is the equivalent UI route.
- **`entity_detail(0)` on a large scene is enormous** — 3,335 lines / 79 KB on a 106-parcel scene, mostly `inspector::Nodes` plus the parcel list, which is big enough to overflow a tool result (observed 2026-10-10). Redirect it to a file and `grep` out only the component you need. And because `set_component` **merges** top-level keys, write back only the key you changed — never the whole component you just read.
- **A thumbnail you generate (Blender render, image tool, screenshot) has to meet the publish spec before you point the scene at it.** Publishing to a World rejects any thumbnail over **1,048,576 bytes** — `Invalid thumbnail: size 1185064 bytes exceeds maximum of 1048576 bytes (1MB)`, hit with an ordinary 1920x1080 PNG. That check is **not** in creator-hub; the Worlds content server enforces it at deploy time, so neither the editor nor a local build warns you first. The editor validates the rest: `.png`/`.jpg` and **16:9 within a 1 % tolerance**, recommended 1920x1080 (the Hub's own captures are centre-cropped to 16:9 and capped at 1920 wide).
- **So: render 16:9 (1920x1080, or 1344x756 for a lighter file), export JPEG at high quality rather than PNG** — `ffmpeg -i cover.png -q:v 2 cover.jpg` came out around 100 KB at 1344x756 — and keep a PNG only if it actually stays under the cap. **Check the byte size (`ls -l`) and the dimensions (`sips -g pixelWidth -g pixelHeight`) before writing the path into the scene**, not after a failed publish. Save it under a distinct name and repoint the scene as above — never `assets/Images/autogenerated-thumbnail.png`.
- **Every thumbnail must survive a square crop: put text, logo and main subject inside the central square.** Parts of the platform show only the centre 1080x1080 of a 1920x1080 image, cutting `(1920 - 1080) / (2 * 1920) ≈ 0.219` of the width off **each** side (`THUMBNAIL_SAFE_AREA_INSET`). That's x 420–1500 at 1920 wide and x 280–1000 at 1280 wide. This applies whether you capture, render or compose the image. Before pointing the scene at it, crop the square and look at the result. Don't judge it from the full frame: a title that runs edge to edge looks fine there (Locksmith, 2026-10).

  ```bash
  OUT="${TMPDIR:-/tmp}/cover-square.png"
  # macOS
  H=$(sips -g pixelHeight cover.png | awk '/pixelHeight/{print $2}'); sips -c $H $H cover.png --out "$OUT"
  # ImageMagick (any OS)
  H=$(magick identify -format %h cover.png); magick cover.png -gravity center -crop ${H}x${H}+0+0 +repage "$OUT"
  ```

  Then `Read` the square image. Every word of the text must be in it.
- **No `node` / `npx` on PATH is not a dead end.** The Creator Hub ships a complete Node (v22, with `npm` and `npx`) and runs every `sdk-commands` child on it: macOS `/Applications/Decentraland Creator Hub.app/Contents/Resources/node-bin/bin/{node,npm,npx}`, Windows `resources\node-bin\node.exe` (plus `npm.cmd` / `npx.cmd`) in the `resources` folder next to the Creator Hub executable, Linux `resources/node-bin/bin/`. Call it by absolute path for `npx tsc --noEmit`, `npx skills add decentraland/sdk-skills --all`, `gltf-transform`, and the like on a creator's machine that has no Node of its own. (Development builds of the Hub carry no bundle and use the developer's Node.)
- **`asset-packs::Placeholder` `src` needs a resolved file path, not a template variable.** The catalog stores paths with `{assetPath}/model.glb` as a template; setting that string literally via `set_component` produces an invisible or broken gizmo because the engine cannot resolve the variable. `place_smart_item` resolves the path automatically (e.g. to `assets/asset-packs/spotlight/spotlight.glb`). If you must set `Placeholder` manually, use the real on-disk path to the GLB file.
