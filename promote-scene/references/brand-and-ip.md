# Decentraland brand and IP rules for promo material

Two separate concerns: how the kit may refer to Decentraland (optional, with rules), and whether the game's own name, art and assets are clear to promote (the creator's responsibility; you flag, never clear).

## Mentioning Decentraland is optional

A game on the platform does not have to name Decentraland or show its logo. The kit promotes the **creator's** game under the **creator's** brand. Mention Decentraland where it helps the reader (the jump-in link is on decentraland.org anyway, "free, in your browser, on Decentraland" earns the tap), and leave it out where the post is about the game's world and voice. Never make the Decentraland logo the hero of a post image.

## Name usage ("How to Talk About Decentraland", brand guidelines p. 30)

Source: *DCL Brand Guidelines 2024-03.pdf* in the media kit, https://drive.google.com/drive/folders/1qX5snvvTxc-8fmX9RepW7BcPfWio1la7 (read 2026-10-19; re-check if the creator is submitting to the Foundation).

- Write **Decentraland** in full. **DCL** only for an audience that already knows it (a community Discord, the game's own regulars), never in press copy, listing copy or a first-contact post.
- Decentraland is "a virtual social world". Describing it as "a metaverse" is fine. Do not call it a game, an app or a company.
- Capitalisation of in-world things: **Wearables, Emotes, LAND, NAMEs, Worlds, MANA, Genesis City**. Say "a Decentraland World" / "on Genesis City", not "a world" / "the map", when the distinction matters.
- Event timings in **UTC** (already the rule for `listing.events`).
- Decentraland is not owned by one entity; it is governed by its community through the Decentraland DAO and supported by the non-profit Decentraland Foundation. Do not write "Decentraland's new game", "Decentraland presents", "official", "partnered with Decentraland" or anything that reads as an endorsement unless the Foundation actually said so in writing.
- Do not write "we"/"us" meaning Decentraland. "We" in a post is the creator's team.

## Using the Decentraland logo (brand guidelines pp. 4–8)

Logo files: https://drive.google.com/drive/folders/1HGyUKy-6FgXDiWs-eZrOuVNZWAtKPrhf (`.ai`, `SVG/`, `PNG/`, `AnimatedLogo/`). The PNGs are usually all that is needed: https://drive.google.com/drive/folders/1200WEi3nsZpb3C0-v0KwSb15xsYPg2Jj — `DCL_logo_{fullcolor,black,white}.png` (icon + "Decentraland"), `DCL_short_logo_{black,white}.png` (icon + "DCL"), `DCL_icon_{fullcolor,black,white,outline,outline_black}.png`, plus seasonal `DCL_icon_halloween.png` / `DCL_icon_xmas.png`. Download, do not redraw. Tell the creator where the files are; this skill does not fetch them for you.

Rules when a logo does go on a kit image (key art corner, X header, "available on" badge):

- Use the files as they are. Never alter, rotate, stretch, narrow, recolour, italicise, add a drop shadow or gradient to the typography, flip the icon, or change icon/wordmark proportions. No outdated versions.
- Variants: full-colour icon, or flat black / flat white. The main logo is never shown in grayscale. The **outline** icon is never used next to text.
- Clear space: at least the height of the "D" on every side. Minimum sizes: icon 36×36 px, logo 192×36 px. On a 1080 px social image that means the logo is a small badge, not a second title.
- Legibility: full colour on light or dark neutral backgrounds; flat white on busy renders or dark key art; flat black on light plates. Not over the subject of the shot.
- Brand colours (if a "Play on Decentraland" badge or strip needs one): Ruby `#FF2D55`, Orange `#FF7439`, Shadow `#161518`, White `#FCFCFC`; secondary Yellow `#FFC95B`, Lavender `#C640CD`, Purple `#691FA9`. Typeface Inter (Google Fonts). Pure black `#000000` is not used in digital pieces. None of this applies to the game's own logo, which keeps its own palette and font.
- `make_logo.py` and `compose_social.py` do not place the Decentraland logo. If the creator wants it on the key art, add it by hand (or extend `compose_social.py` for that kit) and read the result against the rules above.

## The game's own IP (Decentraland Content Policy)

Source: https://decentraland.org/content (read 2026-10-19). Promo material is public content about content on the platform, and the same policy applies to what it shows. The relevant points:

- The creator must own, or hold a licence for, everything in the scene and in the kit: the title, the logo, the 3D models, textures, music, voice lines and any image the posts use (section 6). Third-party IP without a licence is prohibited content (2.2), and using the platform grants no licence to other creators' content (section 8).
- Content must not be false or misleading (2.4) and the creator warrants it is accurate (6b). This is the policy reason behind **RULE: No invented facts**: a post that claims a feature the game lacks, or shows a render of something not in the scene, is a policy problem, not only a taste one.
- Restricted content (intensely violent or graphic, gambling, sexually explicit) is 18+ and needs clear warnings (section 5). If the game is in that territory, the posts and images must carry the same warning and must not be aimed at a general audience; say so in the README. Gambling content additionally needs licensing and geo-blocking (section 3), which is out of this skill's scope: flag it.
- No personal information in content (section 6): no real names with contact details, no addresses, in copy or in screenshots.

What this skill does:

- **Title**: flag a known franchise, an existing game's name, a brand or a celebrity in the title. Say "possible conflict: …" and leave it to the creator. Never write that a check passed (same rule as the marketing checklist).
- **Logo and key art**: the generated wordmark uses a system font and the game's colours, so it is the creator's. Do not imitate a known logo's lettering or a franchise's trade dress even when the creator asks for "something like X".
- **Models and audio**: a scene built from Creator Hub asset packs or the creator's own GLBs is fine to render. If `design/references.md` or the asset folder names third-party models, fonts or music (CC BY, store assets, ripped game assets), check the licence allows promotional use and attribution is in place. Credits go in the scene description, not in posts; list the gap in the README.
- **Inspirations** (another game, film, meme): they stay out of the copy unless the owner opts in, and even then as "inspired by", never as a comparison that implies affiliation. Never use another property's characters, names, art or quotes in posts or images.
- **Avatars and people**: screenshots with other players' avatars or names should be used only with their consent; prefer footage of the creator's own avatar. Wearables shown in footage are fine.
- **README**: a short "Rights" note listing what was flagged (title, third-party assets, restricted-content warnings), with the two links above, so the creator can resolve them before posting.
