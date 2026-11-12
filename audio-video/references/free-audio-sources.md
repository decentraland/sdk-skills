# Free audio sources: real recordings

Where to get real recordings that a published, possibly commercial, Decentraland scene can use. Licences were checked at each source on 2026-11-11 (ElevenLabs 2026-11-12); re-check the licence of **each file** you download, since most sites mix licences. Deployed scene files are publicly downloadable from the content servers, so a sound ships to anyone who loads the scene.

Confirm downloads with the user first (**sdk-scenes** → confirmation rules), and record the credit as you download (→ *Attribution*).

## Pick a source

Ordered by usefulness and safety for scene sound design.

| # | Source | Licence | Credit | Commercial | Access | Strong at |
|---|---|---|---|---|---|---|
| 1 | Freesound (CC0 filter; CC BY second) | per sound: CC0, CC BY, CC BY-NC | CC0 no; CC BY yes | CC0 and CC BY yes; BY-NC no | API with a free key; HQ previews by plain `curl` | everything: foley, ambiences, creatures, machines, UI |
| 2 | NPS Yellowstone sound library + NPS Sound Gallery | public domain | courtesy, asked "where appropriate" | yes | `curl` | animals, geothermal vents, wind, night soundscapes, insects, machines, weather |
| 3 | Wikimedia Commons (PD/CC0 filter) | per file | PD/CC0 no | PD/CC0 yes | API + `curl`, strict pacing | foley, household and mechanical sounds, copies of NPS recordings |
| 4 | Sonniss GDC Game Audio Bundles | Sonniss royalty-free licence | not required | yes, in finished projects | browser or official torrent, multi-GB archives | professional libraries: weapons, impacts, vehicles, ambiences |
| 5 | Kenney audio packs | CC0 | not required | yes | browser zip | UI, interface, impacts, RPG foley, casino, sci-fi, voice-over |
| 6 | NASA (images-api) | NASA media guidelines: generally not copyrighted in the US | NASA "should be acknowledged" | yes, with limits | keyless JSON API + `curl` | rocket launches and engine tests |
| 7 | Internet Archive (PD-mark/CC0 filter) | per item, set by the uploader | PD/CC0 no | PD/CC0 yes | keyless API + `curl` | long field recordings and city/room soundscapes (radio aporee) |
| 8 | OpenGameArt (CC0 filter) | per entry: CC0, CC-BY, OGA-BY, CC-BY-SA, GPL | CC0 no | CC0 yes | `curl` | game SFX packs; few field recordings |
| 9 | Pixabay sound effects | Pixabay Content License | not required | yes (no standalone resale) | browser only | quick generic SFX; quality and provenance vary |
| 10 | NOAA Fisheries "Sounds in the Sea" | US federal work [UNVERIFIED for audio, see below] | asks "NOAA" credit | [UNVERIFIED] | direct MP3/WAV links | whale and seal calls (raw material for creature voices and drones) |
| 11 | ElevenLabs sound-effects library (last resort) | site FAQ vs Terms of Use disagree, see below | yes, "elevenlabs.io" | [UNVERIFIED] | `curl`, no account or key | sounds the others lack: cartoon, sci-fi, UI, stylised monsters. AI-generated, uncurated |

## Freesound (with an API key)

Huge, searchable, licence on every sound. Use the **CC0** filter first, **CC BY** (with credit) second. Never use **CC BY-NC** (`Attribution NonCommercial`) sounds. The site's own FAQ notes that some uploads cannot be used commercially and many need credit.

**Key**

1. Ask the user for their key; they create it. Never search the machine, the scene or the environment for one. They log in to freesound.org and apply at `https://freesound.org/apiv2/apply`; the key is the **"Client secret/Api key"** value.
2. Keep it in an environment variable (`export FREESOUND_API_KEY=...` in their shell) or a local untracked file outside the scene. Keep it out of the scene repo, the scene code, `.mcp.json`, notes and any skill example; examples use the placeholder `FREESOUND_API_KEY=example123`. The API terms require keys to be kept secret and revoke shared ones. Put the `export` in the startup file of the shell your Bash tool runs: Claude Code on macOS can run `/bin/bash`, which never reads `~/.zshrc`, so a key exported only there is missing from the agent's shell (observed 2026-11-11). Check with `[ -n "$FREESOUND_API_KEY" ] && echo set`, never by printing the value.
3. Send it as a header, `Authorization: Token $FREESOUND_API_KEY`, which keeps it out of URLs and logs. The docs also allow a `token=` query parameter.

**What a plain token allows, and what needs OAuth2** (APIv2 docs):

| With the token | Needs OAuth2 (`Authorization: Bearer <access token>`, 24 h tokens) |
|---|---|
| search, sound metadata, similar sounds | `GET /apiv2/sounds/<id>/download/` (original file), pack download |
| preview URLs (`previews` field). The files on `cdn.freesound.org` download with no auth at all | upload, describe, rate, comment, bookmark |

HQ previews are MP3 ~128 kbps (`preview-hq-mp3`) and Ogg ~192 kbps (`preview-hq-ogg`). That is enough for most scene sounds, which end up as Ogg q4 anyway. For heavy processing (deep varispeed), ask the user to download the original WAV from the sound's page while logged in on the website (downloads there need an account).

**Search, then download previews** (one request returns every field you need):

```bash
curl -sS -G https://freesound.org/apiv2/search/ \
  -H "Authorization: Token $FREESOUND_API_KEY" \
  --data-urlencode 'query=owl hoot night' \
  --data-urlencode 'filter=license:"Creative Commons 0" duration:[1 TO 30]' \
  --data-urlencode 'fields=id,name,username,license,duration,previews,url' \
  --data-urlencode 'page_size=50' -o search.json

# pick a result, then fetch its HQ preview (no key needed for the CDN file)
curl -sSL --fail -o sound-design/src/freesound/<id>.ogg "<previews.preview-hq-ogg of that result>"
```

- `filter` uses Solr syntax: `license:"Attribution"` for CC BY, ranges as `duration:[1 TO 30]`, words as `tag:wind`. `page_size` up to 150 (default 15).
- The `filter` takes licence *names*: `"Creative Commons 0"`, `"Attribution"`, `"Attribution NonCommercial"`. Responses return the licence as a *URL* (e.g. `http://creativecommons.org/publicdomain/zero/1.0/`), which carries the version (3.0/4.0) a CC BY credit needs. Verified with a key, 2026-11-11.
- **Rate limits**: 60 requests/min and 2,000/day; original downloads (and uploads, rating, commenting) 30/min and 500/day. Over the limit: HTTP 429 with a `detail` naming the limit.
- **API terms**: retrieve only what you use; no full copies of the database, no scraping. The terms say commercial use *of the API* is negotiated case by case with UPF (Freesound's operator). Each sound's own licence governs its use in the scene. [UNVERIFIED: whether a commercial studio searching the API to build a scene counts as commercial API use; ask Freesound if that matters to the user.]

## NPS: Yellowstone sound library and Sound Gallery

Public domain. Yellowstone page: "recorded in the park and are in the public domain. They may be downloaded and used without limitation; however, please credit the 'National Park Service' where appropriate." Sound Gallery (`https://www.nps.gov/subjects/sound/gallery.htm`): "in the public domain and may be downloaded … please give the appropriate credit."

- **Yellowstone** (`https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm`): birds (raven, sandhill crane, common loon, Canada goose, …), other animals (red fox, elk, coyotes, wolves, grizzly bear, bison, mountain lion, frogs and toads), geothermal (fumaroles, Black Growler steam vent, geysers, mud pots), natural phenomena (thunder, wildfire, singing lake), soundscapes (night lake, dawn chorus, wind in trees).
- **Sound Gallery**: amphibians, birds, insects, mammals, reptiles, geological, hydrological, meteorological, machines, cultural-historical, from many parks.
- Both libraries link per-sound pages, not files. Get the MP3 from the page:
  `curl -sL -A "<tool-name>/1.0" <page-url> | grep -oE 'https://www\.nps\.gov/nps-audiovideo/[^"'"'"']*\.mp3' | sort -u`
  Yellowstone files follow `https://www.nps.gov/nps-audiovideo/legacy/mp3/imr/avElement/yell-<Name>.mp3`; Sound Gallery files use other folders (e.g. `…/legacy/mp3/nri/avElement/nri-OspreyGRTE.mp3`).
- Geothermal vents slowed down make excellent drones and hums, and slowed animals excellent creature voices (`sound-recipes.md`).

## Wikimedia Commons

- Search: `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=<terms>+filetype:audio&format=json`, then `action=query&prop=imageinfo&iiprop=url|extmetadata&titles=File:<name>` to read `LicenseShortName`, `Artist` and the file `url`. Keep public domain and CC0; CC BY / BY-SA only with credit (→ *Attribution*).
- Commons hosts copies of the NPS Yellowstone recordings (`Yellowstone sound library - <animal> - 001.mp3`), sometimes ones the NPS page lacks.
- Files named `LL-Q…` are Lingua Libre word pronunciations, not sound effects; skip them.
- Rate limits: the API returned HTTP 429 after ~8 rapid requests; the file server (`upload.wikimedia.org`) returned 429 after ~20 quick downloads and locked out for ~15 minutes. Pace downloads **10 s or more apart**.

## Sonniss GDC Game Audio Bundles

`https://sonniss.com/gameaudiogdc`. Professional sound libraries released yearly (2015–2024; no 2025 bundle). Site: "All of the sounds are royalty free and commercially usable. No attribution is required." Licence (`/gdc-bundle-license/`): use on unlimited projects for life; finished projects "may be shared, published and sold in the normal way"; the files may not be supplied "as sound effects" (in a library, sample pack, asset pack or project template); AI/ML training is prohibited.

- Downloads are multi-GB archives via the site's links, official torrents or mirrors; the site refused plain `curl`. The user downloads; you search the extracted folders by filename.
- Ship processed sounds, never the raw library files. Keep the extracted library outside the scene folder (or in a `.dclignore`d path) and out of public repos. [UNVERIFIED: whether lightly edited single files in a deployed scene, which anyone can download, count as supplying them "as sound effects"; ask Sonniss before relying on near-raw files.]

## Kenney audio packs

`https://kenney.nl/assets/category:Audio`: packs such as `impact-sounds`, `interface-sounds`, `ui-audio`, `rpg-audio`, `sci-fi-sounds`, `casino-audio`, `digital-audio`, `music-jingles`, `voiceover-pack`. Kenney: "all game assets on the asset pages are public domain licensed (CC0)… free to use them, even in commercial projects. Attribution is not required" (credit "Kenney" welcome; don't use the Kenney logo). Downloads go through a donate-or-continue dialog to a zip, so the user downloads in a browser. Strong for UI and game feedback rather than field recordings.

## NASA

`https://images-api.nasa.gov/search?q=<terms>&media_type=audio` (no key) returns items; each item's `href` lists its files (`…~orig.wav`, `…~128k.mp3`) on `images-assets.nasa.gov`, downloadable with `curl`. Media guidelines: NASA material is "generally … not subject to copyright in the United States"; "NASA should be acknowledged as the source"; commercial use must not imply NASA endorsement; the NASA insignia and logotype are not public domain; identifiable people need their permission, and current NASA employees and astronauts cannot appear in commercial products. So use the machines (launches, engine tests), not the voices. Items credited to third parties are not NASA's to give.

## Internet Archive

Licences vary per item and are set by the uploader. Filter by licence and check provenance:

```bash
curl -sS 'https://archive.org/advancedsearch.php?q=thunderstorm+AND+mediatype%3Aaudio+AND+licenseurl%3A*publicdomain*&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=licenseurl&rows=50&output=json'
curl -sS https://archive.org/metadata/<identifier>        # licenseurl, creator, file list
curl -sSL -o out.mp3 https://archive.org/download/<identifier>/<file>
```

`*publicdomain*` matches both the PD mark and CC0. Many hits are radio aporee field recordings (places, rooms, weather). Skip items whose licence field is empty or that look like rips of commercial media.

## OpenGameArt

Search sound effects with the CC0 licence filter: `https://opengameart.org/art-search-advanced?keys=<terms>&field_art_type_tid%5B%5D=13&field_art_licenses_tid%5B%5D=4` (type 13 = Sound Effect, 12 = Music; licence 4 = CC0). Entry pages link files under `https://opengameart.org/sites/default/files/` (`curl`-friendly). An entry may list several licences; read its `License(s)` line. OGA-BY, CC-BY and CC-BY-SA need credit; GPL entries are not suited to scene assets. Mostly game-made SFX, few field recordings.

## Pixabay sound effects

Pixabay Content License: use free, commercial or not, without attribution, and modify. You may not sell or distribute content "on a Standalone basis" (no creative effort applied), use trademarks commercially, or skip third-party consents the content may need. The Pixabay API covers images and videos only, and the site refused plain `curl`, so the user downloads from the browser. Uploads are user-made and quality varies; prefer the sources above for anything that must sound real.

## NOAA Fisheries "Sounds in the Sea"

`https://www.fisheries.noaa.gov/national/science-data/sounds-ocean`: baleen and toothed whales, dolphins, seals, sea lions, walruses, with direct MP3/WAV links; sibling pages hold fish and invertebrate, environmental and human-made sounds. The page has no explicit rights statement; it shows how to credit ("NOAA …"). NOAA Fisheries' website policy says NOAA-created images are not subject to US copyright, while other material on its sites came from contractors or third parties. [UNVERIFIED for audio: confirm a recording is NOAA-created before shipping it in a commercial scene.]

## ElevenLabs sound-effects library (last resort)

`https://elevenlabs.io/sound-effects` links about 350 category pages (`/sound-effects/<slug>`, e.g. `owl`, `wolf`, `monster-growl`, `horror-ambience`, `thunderclap`, `game-ui`), each with about 11 clips. Take slugs from that index page; guessed ones failed (`door-creak` returned 404, `thunder` a page with no clips; 2026-11-12).

**Why last:** the clips are AI-generated, not recordings, and nobody curates them. Quality varies from clip to clip and some sound synthetic, which is the problem real recordings solve. Use it when the sources above have nothing for a sound, mostly stylised ones (cartoon, sci-fi, UI). Check every clip's spectrogram and have the user listen before it goes into the kit.

**Download** (verified 2026-11-12: no account, no key, plain `curl`). The category page's HTML holds each clip's CDN URL:

```bash
curl -sSL -A "scene-audio-research/1.0" https://elevenlabs.io/sound-effects/owl \
  | grep -oE 'https://eleven-public-cdn\.elevenlabs\.io/payloadcms/[a-z0-9-]+\.mp3' | sort -u
curl -sSL --fail -o sound-design/src/elevenlabs/owl-8.mp3 "<one of those URLs>"
```

Files are MP3 at 128 kbps, 44.1 kHz stereo, with no metadata. The test cowbell clip started with about 0.35 s of silence: trim it.

**Licence: unclear, so always credit.**

- Category-page FAQ: "all ElevenLabs Sound Effects are royalty free and can be used in commercial projects", but "do not sell or license our tools or use the output to develop competitive products or services". Same FAQ: "our free plan requires attribution to elevenlabs.io. Our paid plans do not require attribution".
- Terms of Use §1(c)(i): free users "may only use the Services for non-commercial purposes". The Terms do not mention the library.
- [UNVERIFIED: whether downloads made without an account count as free-plan use, and so as non-commercial only.]
- So credit "Sound effects: elevenlabs.io" in every scene that uses one (→ *Attribution*). For a commercial scene (paid entry, sales, sponsorship), prefer another source, or have the user confirm with ElevenLabs or use a paid plan.

## Not suitable for a published scene

- **BBC Sound Effects archive** (`sound-effects.bbcrewind.co.uk`): free only for "personal/educational projects"; other use must be licensed. Secondary sources name it the RemArc licence (personal, educational, research). Use it only if the user buys a licence.
- **xeno-canto** (bird and animal calls): each recording is under BY-NC-ND, BY-NC-SA or BY-SA (terms page). The two NC licences exclude commercial use, and ND forbids editing; BY-SA recordings are usable but make the edited sound BY-SA (→ *Attribution*). [UNVERIFIED: share of NC recordings; filter per recording.]
- **Freesound CC BY-NC**, OpenGameArt **GPL**, and anything with no stated licence.

## Download hygiene

- Use `curl` (`-sSL --fail`). On macOS the system Python's `urllib` failed SSL certificate verification against NPS and Commons; `curl` worked.
- Send an honest, descriptive `User-Agent` naming a generic tool (`-A "scene-audio-research/1.0"`). Never send a browser string or the user's personal details. When a site refuses plain `curl`, hand the download to the user.
- Keep raw downloads in a source folder outside the deploy (e.g. `sound-design/src/`, in `.dclignore`), not in `assets/`.

## Attribution

**Rule:** every file whose licence or terms ask for credit gets one: CC BY, CC BY-SA, OGA-BY, Freesound "Attribution", NASA ("should be acknowledged"), NOAA, ElevenLabs ("elevenlabs.io"). Add it when the file enters the kit, not at release.

**Where**

1. **The scene's record**, `design/audio-sources.md`: one TASL line per source file, plus which game sounds use it and how it was processed. This is the source of truth for every visible credit.
2. **A credit players can see.** `scene.json` has no credits field: `display` holds only `title`, `description` (shown on the navmap and Places card), `navmapThumbnail` and the deprecated `favicon` (`@dcl/schemas` `platform/scene`). Options, best first:
   - an in-scene **credits sign or Credits UI panel** listing the TASL lines (players see it where they hear the sounds);
   - a short line at the end of `display.description` after the pitch, e.g. *Sounds: NPS, Wikimedia Commons and Freesound contributors (CC0 / CC BY); full credits on the sign at spawn.* (the pitch comes first; **deploy-scene** → description);
   - the README, when the scene's repo is public.
   CC BY 4.0 allows any reasonable manner for the medium, including "a URI or hyperlink to a resource that includes the required information" (§3(a)(2)), so a description line pointing at the in-scene credits or a public page with the full list works.

**Format: TASL** (Creative Commons' recommended practice): **T**itle, **A**uthor, **S**ource (link), **L**icence (name + link), plus **modified** when you processed it. CC BY 4.0 requires indicating modifications (§3(a)(1)(B)).

> "Owl hoot at dusk" by example_user (https://freesound.org/s/000000/), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), modified: slowed, filtered, layered.

**CC BY-SA puts your edited sound under BY-SA too.** The adapted file must carry a Creative Commons licence with the same elements (BY-SA, this version or later) or a BY-SA-compatible one (BY-SA 4.0 §3(b)), so anyone may reuse that sound from the deployed scene. Prefer CC0 or CC BY for scene sounds; if a BY-SA source is used, credit it and state that the derived file is BY-SA.

**Public domain and CC0 need no credit.** A courtesy credit is fine and is what NPS asks for "where appropriate". Example line: *Sound recordings: National Park Service (Yellowstone sound library) and Wikimedia Commons contributors, public domain / CC0.*
