# Coming back to a kit: update or resume

`promote/` already exists. Do not start over, and do not trust `README.md`: read the folder.

```bash
find promote -type f -not -path '*/node_modules/*' | sort
cp {baseDir}/scripts/build_kit.py promote/tools/build_kit.py     # always first: it holds nothing per scene
python3 promote/tools/build_kit.py --skill {baseDir}/scripts     # WARNING = broken or stale, NOTE = the kit's state
```

Copy the builder before running it. A kit made before the stale-tool check has a `build_kit.py` that ignores `--skill` and prints no notes, so the kit would look current. The new builder stops on an option it does not know.

- Outputs are missing (`kit-data.js`, `images/keyart/`, `images/social/`, `copy.md`) → **Resume**: a run stopped mid-way.
- The kit is complete and the scene has moved on (deployed, renamed, redesigned, an event passed) → **Update**.

## Update

`posts.json` is the truth, the creator's edits included. An update changes the entries that are stale and leaves the rest byte for byte: never regenerate the kit from the design docs.

1. **Ask once what has already been posted.** Put `"posted": "<date>"` on those posts (the page shows it). A posted post is history: its text is never rewritten.
2. **Find what is stale.** The builder's lines, plus `scene.json` and the creator's own account of what changed:

| What changed | How you know | Redo |
|---|---|---|
| The scene is deployed | `NOTE: not published`, and SKILL.md step 2 now derives a link | Set `link`. Run the link-card check of step 2 (the card comes from the **deployed** title, description and thumbnail). Turn coming-soon posts into launch posts (below). |
| Title or tagline | `scene.json` `display.title` differs from `game` | Ask first: a rename is the creator's decision. Then `game` / `tagline`, `make_logo.py`, `compose_social.py`, every unposted text that names the game, `listing`. Videos already rendered carry the old end card: list them, re-render only the ones the creator asks for. |
| Description, tags, thumbnail | `NOTE: edited after posts.json: scene.json` | The metadata check of step 3; `listing.short` and `listing.long`. |
| The design | `NOTE: edited after posts.json: design/…` | Re-read it. Check every claim in every unposted post against it (length, mechanics, endings, "free", player count); a removed feature leaves the copy. A new signature moment gets one new still and one or two new posts with new ids. |
| What the players did | the creator reports on the plan | Audience rows they confirmed become `source: "creator"` and leave `assumptions`. Write the next experiment into `plan`; the earlier one and its result go in the README. |
| Venues | `verified` is older than a month | Re-read the rules before any new post there: they change. Update `rules`, `verified`. |
| An event passed | `event.when` is in the past | Fill the recap post from what the creator reports: numbers and quotes only from them (`{baseDir}/references/events.md`). |
| The tools | `WARNING: promote/tools/… is <date>; the skill now has <date>` | Copy the new file in. For `render_shots.py`, keep the per-scene sections the warning names. `takes.py` is the scene's own file and is never checked; compare it with `takes.example.py` by hand when a capture fails. |

3. **Coming soon → launch.** For each unposted `soon` post: keep its `id` (ids name video files and venue links), set `kind: "launch"`, and rewrite the line in the present tense with `{LINK}`. The `{N}` / `{DATE}` countdown template has no launch form: delete it if it was never posted. `footage`, `quote` and `bts` posts that said "coming soon" in passing get the same edit.
4. **Rebuild only what the changes touch**: `make_logo.py` and `compose_social.py` for a name, tagline or colour; one named still or render for a new moment; nothing for a link.
5. `build_kit.py --skill {baseDir}/scripts` until it prints no WARNING, then screenshot the page and read it (SKILL.md step 9).
6. **README**: correct what it says, and add an "Updated <date>" line with what changed.
7. **Report**: what changed and why; what was left alone (posted posts, rendered videos); what still needs the creator (a redeploy when the link card is stale, a `[CHECK]`, a video to re-render).

## Resume an interrupted run

The usual cause is the final render pass. Typical state: `posts.json`, `tools/`, `logo/` and `images/preview/` exist, `images/renders/` has the first shot or two, and `keyart/`, `social/`, `kit-data.js`, `copy.md` and `footage-shotlist.md` are missing.

1. `pgrep -fl Blender` (Windows: `tasklist | findstr /i blender`): nothing may still be rendering.
2. Read the preview PNGs and the finals that exist. If they look right, the `SHOTS` section is done: render only the missing shots by name (`-- final cage plaque`) and `-- keyart`, then continue from SKILL.md step 8.
3. Re-read the README against the finished folder and correct every claim that is not true.
