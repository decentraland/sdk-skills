# Publishing from the Creator Hub

Read this when walking a creator through the Creator Hub's **Publish** flow or its **Manage** pages, or when they read you a message from them. Strings are the app's English UI (creator-hub `locales/en.json`). The CLI equivalents are in [`deploy-cli.md`](deploy-cli.md).

## Before the upload

- **Publish saves first.** Pending editor writes are flushed before anything is built; if that fails, publishing stops: *"Couldn't save your scene before publishing, so publishing was stopped to avoid deploying older content. {reason}"*.
- **Target picker.** *Publish to LAND* lists only parcels the signed-in wallet can deploy to: owner, approved, update operator, approved-for-all or update manager on the LAND registry, and the estate equivalents. LAND rented out (for the lessor), revoked operators or managers, and approvals on the wrong registry are hidden. The **Owner** / **Collaborator** chip appears only on deployable LAND. The scene deploys to the parcel or World picked there, not to the parcels still in `scene.json`.
- **World details must load.** If a World's settings, scenes or permissions cannot be fetched: *"We couldn't load this world's details. Check your connection and try again."* with **Retry**; the flow does not continue as if the World were empty.
- **Size limit.** The Deploy step header reads `Total Size {size} / {limit}`: Genesis City allows **15 MiB per parcel** for the whole scene; a World's limit comes from the worlds server (`/world/:name/limits`) and shows *"Checking limit…"* while it loads (if that request fails, only the total is shown and nothing is blocked). Over the limit the total turns red and **Publish** is disabled. Per-file limits are marked separately. Shrinking a scene: **optimize-scene**, `.dclignore` in SKILL.md.

## Places-continuity warning

A Places listing (likes, favorites, ranking, scene analytics, Multiplayer Server storage) follows the scene only when a redeploy keeps its identity. Before publishing, the Hub checks and shows **"Your scene will lose its Places listing"** with *What stays with the old listing*: *"Its likes, favorites and position in the Places rankings."*, *"Its scene analytics. The new listing starts from zero."*, *"The data in its Multiplayer Server storage, which may be erased."*

- **Genesis City:** shown when the publish keeps **neither** the base parcel **nor** the set of parcels of the scene already there (lookup on Publish, *"Checking…"*). Buttons **Go back** / **Publish anyway**. Tip: *"To keep the current listing, publish to the same base parcel or to the same set of parcels as before."*
- **Worlds:** shown in the confirmation step (Cancel / Confirm) when the placement overlaps two or more existing scenes, or when a single-scene publish would first remove a World's scenes that the new one does not cover. A listing is kept only when the publish replaces exactly one existing scene; the fix for the second case is to turn on multiple scenes for the World and place the scene over the one it replaces.

Before proposing a parcel change for a published scene (moving it, growing it), tell the creator which of these it triggers.

## During the upload

The Deploy step shows a progress bar: *"Preparing the upload..."*, *"Uploading {sent} of {total}"*, *"Batch {completed} of {total} uploaded"*, *"Publishing..."*, and a **Cancel** button (*"Cancelling..."*). A cancelled deploy is not an error and is left out of the deployment history. Cancel and batch progress need the scene's `@dcl/sdk-commands` deploy API (`@dcl/sdk` 7.31.0+); on an older SDK: *"Update the SDK of this scene to cancel deployments from here."*

| Message | Meaning |
| --- | --- |
| *"Can't cancel while the previous scenes are being removed. Try again in a moment."* | A single-scene World publish is removing the World's other scenes; cancel is possible once that finishes. |
| *"Couldn't cancel the deployment from here. Quit Creator Hub to stop it."* | The Hub cannot reach the deploy it started. |
| *"Lost track of the deployment, which may still finish. Check the scene in the Manage section before publishing again."* | Progress stopped arriving; check before retrying. |
| *"The deployment did not finish within 60 minutes and may still be running. …"* | The 60-minute deploy timeout; check Manage before publishing again. |

## After the upload

- The success screen adds: *"The scene itself is live now. Its card in the explorer — title, description and thumbnail — is indexed separately and can take a few minutes to catch up."* A stale card right after publishing is not a failed deploy.
- The share link and **Jump In** point at the parcel actually deployed (share-link forms: SKILL.md → *The link to share after publishing*). The World success step links to the World's Settings.

## Manage: Worlds | LANDs

**Manage** has **Worlds** and **LANDs** tabs, each with All / Published / Not Published filters, Last Updated / Name sort and search.

- **World card** ⋮ menu: Jump In, Copy URL, Create Event, View Storage, Unpublish (stream-only Worlds are listed too). The card opens the **World detail page**, which replaces the old World Settings and World Permissions modals. Tabs by role: owner **Details / Scenes / Settings / Collaborators**; a World-wide collaborator **Details / Scenes / Settings**; a parcel-only collaborator **Scenes** (their parcels only).
  - *Details*: World Name (≤ 50 chars), Description (≤ 140), Categories, Thumbnail (*"PNG or JPG | 1920x1080 (16:9)"*). This is the World metadata of **deploy-worlds** → *World metadata vs scene metadata*.
  - *Scenes*: storage used with **Manage Storage**, a read-only Multi-Scene World indicator, a World Map toggle, per-scene Unpublish and Download. Unpublishing the last scene warns that it takes the World offline and deletes its title, description, thumbnail and settings.
  - *Settings*: Spawn Coordinate, Night/Day Time (skybox; *Auto (Decentraland Time)*), Discoverable in Places, Single Player (*"Live streaming is not supported in single player mode."*), Access (Public / Invitation Only with wallets, communities or CSV import / Password Protected, min 8 chars with 2 numbers).
  - *Collaborators*: up to 100, deploy permissions per parcel set, and a **Stream** column.
- **LAND card** ("Parcel {x,y}" / "Estate {id}", role tag Owner / Collaborator / Tenant) ⋮ menu: Jump In, Copy URL, Create Event, Transfer. The **LAND detail page** has **Details / Scenes / Collaborators / Managers**:
  - *Details*: Land Name and Description, saved on-chain (a wallet transaction). *Domain Name* links a Decentraland NAME to the LAND: it writes the NAME's contenthash as a redirect to `…/jump?position=x,y`, so `name.dcl.eth.limo` lands on the parcel; a NAME with no resolver takes two transactions (*Set up NAME*, then *Link to LAND*, shown as *Step n of 2*). NAMEs linked the older IPFS way read as not linked.
  - *Scenes*: Name / Parcels / Location / Last Updated / Published by, per-row and bulk **Unpublish selected**, and **Download {scene}**, which builds an importable project zip with a `RECOVERY.md` (*"Custom code can't always be recovered from a published scene"*).
  - *Collaborators* can publish on this LAND (all parcels, N parcels or custom parcels); *Managers* can publish and manage collaborators on **all** the owner's LAND.
  - **Transfer** is irreversible; it takes a wallet address or NAME.
