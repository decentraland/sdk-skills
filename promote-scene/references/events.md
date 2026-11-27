# Events: one dated gathering, its listing and its four posts

Use when the creator names a gathering with a date: a launch night, a playtest session, a weekly match, a seasonal party. The plan's first experiment is often one ("20 by hand" works best invited to a set hour), so offer it there. Default kits have no event.

**The date, the host and what happens come from the creator.** Never propose a date as if it were set, and never write that something happened before it did.

## `event` in `posts.json`

```json
"event": {
  "name": "Opening night at gate 13",
  "when": "Saturday 5 December, 20:00 UTC",
  "duration": "1 hour",
  "recurring": "",
  "where": "",
  "description": "Board together: we open the airport at 20:00 UTC and walk the first group through security. Find gate 13 before the final call, then compare who you pointed at."
}
```

- `when`: written for a reader, always in UTC and saying so (`build_kit.py` warns otherwise). Posts use the `{WHEN}` placeholder, so a moved date is one edit. A post for a venue in one country may add that country's local time after the UTC one.
- `where`: the place the listing points to; empty means the kit's `link`.
- `recurring`: "every Friday" when it repeats. The standing schedule also goes in `listing.events`.
- `description`: the listing text. Same rules as `listing.short`: verbs first, what you do there, who hosts, how long. No claims the design docs do not make.

Setting `event` is the "creator mentioned events" case: set `"event_banners": true` so `compose_social.py` writes the two banners (1340×670 and 716×1814, JPEG ≤ 500 KB).

## The listing

`build_kit.py` writes an **Event listing** block into `copy.md`: name, when, where, the description, the banner files. The creator submits it on the Events page (https://decentraland.org/events/); this skill does not. What the Foundation's FAQ says (docs `player/faqs/posting-events.md`, read 2026-11-27): anyone can list an event in Genesis City or a World, LAND ownership is not required; the Foundation reviews it, usually within a few hours; a listing with an empty field may not be published; details can be edited after publishing. The form's exact fields are not recorded here: the creator reads the form, and anything it asks that the kit lacks goes in the report.

## The four posts (`kind: "event"`, one per `phase`)

| `phase` | When it goes out | What it is |
|---|---|---|
| `announce` | once the listing is approved | What happens, `{WHEN}`, who it is for, the listing or jump link. One reason to come at that hour and not another: other people. |
| `countdown` | the day before, or the same day | One line from the game plus `{WHEN}`. Short. |
| `live` | at the start | Two lines and `{LINK}`. "Doors are open." People decide in seconds. |
| `recap` | the day after | A template: `{N}` for every number, `[CHECK: …]` for every quote or name. Filled from the creator's report in an update run. |

- They sit on the X and Instagram tabs with the other posts, and `build_kit.py` warns when an event lacks one of the four.
- The recap shows real people: a screenshot with other players' names or chat needs their permission, and a quote is theirs verbatim or absent.
- A venue post about the event follows that venue's rules like any other (`{baseDir}/references/audience-and-venues.md`). An event made only for one community is the deck's "build something only for them": say so to its moderators first.
- No invented urgency ("last chance", "spots are limited") unless the creator set a limit.

## Afterwards

The event is an experiment with the plan's checks: who joined, who got it, who came back within seven days. The recap reports those, never reach. Coming back to fill it is an update run: `{baseDir}/references/update-and-resume.md`.
