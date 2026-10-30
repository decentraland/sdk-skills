*Filled example — a fictional GDD ("Dock 7") showing what a finished submission looks like. All game/studio/contact names and the World identifier are fictional placeholders, not checked identities. The format is real.*

# Dock 7 (GDD Example)

**Decentraland Creator Success Program**

| |                                                                                                                   |
|---|-------------------------------------------------------------------------------------------------------------------|
| Public experience title | Dock 7 — IP & [Content Policy](https://decentraland.org/content/) status: owner reports original materials; name screening: not searched; unresolved: title screening `TBD:` (fictional example, not clearance) |
| Deployment target | World `dockseven.dcl.eth` |
| Studio / team name | Quiet Orbit (3 people) |
| Date | 2026-08-25 |
| Contact (Discord + email) | discord: @quietorbit-dev · dock7@example.com |

---

## 0. TL;DR

| | |
|---|---|
| **Player promise** | You are crew on a small orbital station. You fix systems to keep it running, while one of you is secretly freezing the crew. |
| **Primary player** | For players who already enjoy social deduction (Mafia-style games) or short puzzle sessions, arriving with friends or from a scheduled Event, looking for a 10-minute round that plays well on a phone. |
| **Current status** | Greybox (dock hall and one task station in SDK7). Playable link: `TBD: first public build after the Week-2 playtest.` |
| **Requested round** | v1 (4-week scope) |
| **Live at end of the round** | A player can run a solo maintenance shift at any hour, and from 4 players join a full saboteur round with voting, ranks, and weekly boards, live in our World. |

---

## 1. Player Promise

**One-line promise.**

You are crew on a small orbital station. You fix systems to keep it running, while one of you is secretly freezing the crew.

**One familiar comparison.**

A social deduction game you can open on a phone: ten minutes of repair work where one crew member is secretly freezing the others — frozen players can be rescued, nobody is killed — and when the station is quiet, the shifts still run solo.

**Why this game.**

We play social deduction every week as a team, and we keep missing a version we can open on a phone in two minutes. Decentraland already gives us avatars and names; we want to build the deduction part on top of them.

---

## 2. First Minutes & How to Play

| Time | Player experience |
|---|---|
| **0–5 seconds after control** | You spawn in the dock hall. Three stations blink red ahead; the nearest one shows a glowing FIX button. |
| **5–10 seconds** | You tap FIX and a 20-second wiring minigame opens. The goal is clear: turn red stations green. |
| **10–60 seconds** | You finish the wire; the station turns green and the crew repair bar at the top moves. If another player is near, their fix moves the same bar. |
| **1–3 minutes** | You complete your first shift of three stations. The board stamps your time and shows today's contract. |
| **3–10 minutes** | At four players a saboteur round starts: now every fix is also an alibi, you watch who goes where, and you vote when a frozen crew member is reported. |
| **Natural stopping point** | The round ends with a reveal. The exit board shows your streak and tomorrow's three contract tasks — your reason to return. |

**Player-facing How to Play.**

- Tap red stations to fix them
- Fill the repair bar to finish shifts
- At four players, one becomes the saboteur

---

## 3. Core Loop

| # | Step (verb) | What the player does (Player input → what they see or hear → what changes) | Why do it again? |
|---|---|----------------------------------------------------------------------------|---|
| 1 | Fix | Tap a red station → a 15–30 second touch minigame → station turns green, crew repair bar advances | Every fix is visible progress toward the crew win — and your alibi. |
| 2 | Watch | Walk between stations → you see who is where and who follows whom | Information wins votes; the saboteur watches to pick a moment. |
| 3 | Report | Find a frozen crew member, tap REPORT → everyone is pulled to the meeting room | Reporting is the only way to stop the saboteur. |
| 4 | Vote | Tap a portrait after quick-chat discussion → one player is voted out, revealed or not | The reveal changes who you trust next round. |

| | |
|---|---|
| **One complete loop takes** | A fix-and-watch cycle takes 30–60 seconds and ends with a green station and bar progress. A full round with report and vote takes 8–12 minutes; the earlier payoff is every green station. |
| **Decision, challenge, or expression** | Whom to follow, whom to accuse, when to trust an alibi, how to vote; as saboteur — when to strike and what alibi to fake. |
| **Shortest satisfying visit / typical session** | 5 / 20 minutes. One solo shift is about 5 minutes; a typical visit is two rounds. |
| **Why repetition 10 remains appealing** | The cast is the game: a different saboteur each round, and reputations from earlier rounds ("she lied last time") change how the same map plays. |

**Pillars.**

1. Suspicion over skill — you win by reading people, not by reflexes.
2. Nobody waits — there is always a station to fix, alone or mid-round.
3. One thumb plays it — every action is a single tap or short drag.

---

## 4. Why Players Come Back

### 4.1 The next-day (D1) sentence

> "A player who enjoyed their first session returns the next day (D1) because Hook 1, the daily contract, rotates its three tasks at 00:00 UTC — and the exit board shows tomorrow's tasks before they leave."

### 4.2 The progression chain

> **Repeatable action → persistent reward → new capability, status, or social role → new decision or challenge**

| Moment | What persists or has been built? | What becomes possible next? | How can another player tell? |
|---|---|---|---|
| **End of first session** | A best time on one shift board, Deckhand rank, a day-1 streak | Tomorrow's contract tasks are already visible at the exit | Rank tag by your name; your board entry is public |
| **End of first week** | Technician rank (from completed contracts) and first endorsements earned in rounds | Technicians can host rounds and pick the weekly modifier for rounds they host | Host badge in the dock hall; endorsements show on the vote screen |
| **Week 3+ — what takes more than two weeks?** | Chief rank needs 15 endorsements — other players must vouch for you after rounds, which cannot be rushed | Chiefs set the side-rule for Friday Crew Night | The Chief's name is on the Crew Night board |

You arrive after the daily reset and your streak stamp is waiting at the door. A player from yesterday's rounds endorses you before the round starts, because you called the saboteur right. As host, you pick this week's modifier — darker corridors — and start the round. Monday wiped your shift times, but your rank and endorsements stayed.

Currency or tradable rewards: N/A — v1 has none.

### 4.3 Two return hooks

| Selected hook | Exact trigger or timing | What the player anticipates | Reminder channel + no-reminder fallback |
|---|---|---|---|
| **1.** Daily goals + streak — the daily contract | Three contract tasks rotate at 00:00 UTC; the streak day counts once one is done, and a missed day spends a recovery token instead of resetting | Tomorrow's named tasks and keeping the streak alive | Community post when the contract theme changes; fallback: the exit board shows tomorrow's tasks before you leave |
| **2.** Recurring scheduled event — Crew Night | Every Friday 20:00 UTC | A guaranteed full crew and this week's modifier | Event listing on decentraland.org; fallback: a countdown sign at spawn |

---

## 5. Social by Design

| | |
|---|---|
| **The repeatable social loop** | Player A reports a frozen crew member → everyone gathers, and Player B defends or accuses in quick-chat → together they vote one player out → the reveal, right or wrong, is visible to all and is the reason to regroup for one more round. |
| **The disappearance test** | Deduction breaks completely — with no live players there is nobody to suspect or to lie to. Only solo maintenance shifts and the leaderboards would remain. |
| **From strangers to a group** | Everyone has the same crew role, and the HUD shows the shared repair bar and a station map, so a newcomer just picks a red station near others. Quick-chat is pictograms (point, suspect, safe), so no voice or shared language is needed. |
| **Recognition & continuity** | Names show above avatars and on the vote screen. Ranks, endorsements, and round history persist — "the player who caught the saboteur twice" — and old reads change how much your accusation is trusted next session. |
| **Quiet hours & player counts** | When few people are online, a solo player can run maintenance shifts against the leaderboard. Social play becomes viable at 4 players (our social threshold); the ideal group is 8; the target player count is 10; capacity has not been tested. A solo arrival lands in the shared dock hall where shifts run at the same stations, so waiting players meet while playing, not in a queue. `TBD: these counts are estimates until the Week-2 playtest.` |
| **Drop-in / drop-out** | A late arrival starts a shift at once and joins the saboteur queue for the next round. If anyone leaves mid-round — even the saboteur — the round continues; a vanished saboteur simply loses. |
| **Visible play (the bystander test)** | You see one player rush a wiring panel while another trails them, watching. |
| **Shareable play (the memorable moment)** | The reveal card after the vote: the crew ejected the wrong person, and the real saboteur waves. |
| **Bring-a-friend** | The moment you are accused and nobody backs you up, you want a friend who knows how you play. Once they arrive, alibis and betrayals get personal — the best part of the genre. |

---

## 6. Mobile-First

**Every core-loop verb on touch.**

| Core-loop verb | How it works with touch controls |
|---|---|
| Fix | Tap the station, then a 15–30 second tap-and-drag minigame |
| Watch | Left-stick walk; the map button shows station status, never player positions |
| Report | One large REPORT button appears near a frozen crew member |
| Vote | Tap a portrait, then confirm; quick-chat pictograms are one tap each |

**UI plan.**

One context action button in the right-thumb zone (FIX / REPORT / VOTE); everything else lives on the repair bar at the top and the map button. Text is minimal and large.

**Performance.**

Target: 60fps on recommended desktop hardware and 30fps on a mid-range Android phone (Pixel 7a class) in the mobile client, both at 10 players — our target player count. The greybox is not profiled yet.

**Desktop-only dependencies.**

None. Pictogram quick-chat and tap-to-vote were chosen so the game never depends on text chat or voice.

---

## 7. World, Look & Story

**Story / world.**

Dock 7 is an aging salvage station that survives only through daily repair shifts. One crew member is secretly paid to let it fail.

**Visual direction.**

Flat colors and high contrast: the station is dark, anything broken glows red, anything fixed glows green, and each player carries a bright shoulder-light in their own color that reads at a distance on a phone. Our signature shot: a dark corridor, one red station, two colored shoulder-lights approaching it. Players keep their own Decentraland avatars — the shoulder-light rig is ours, and we borrow no trade dress.

---

## 8. Audience & Comparables

**Primary player + arrival context.**

For players who already enjoy social deduction (Mafia-style games) or short puzzle sessions, arriving with friends or from a scheduled Event, looking for a 10-minute round that plays well on a phone.

**How the first group arrives.**

The first real groups come from Friday Crew Night Events and one social-deduction Community, because a fixed time concentrates players and four is enough to start. Between events, the shift leaderboards keep solo players in the same hall, so weekday overlap can also reach the threshold.

**Deliberately not for.**

Players looking for a long solo story or building progression — rounds are short, and the game is about people.

### Comparables

| | Comparable A — outside Decentraland: Among Us | Comparable B — outside Decentraland: Goose Goose Duck |
|---|---|---|
| What we observed works | Tasks keep every player busy and let the impostor fake work inside the same loop; 4–15 lobbies and 10–15-minute rounds; born mobile-first, with fixed corner buttons | Extra roles keep veterans coming back; built-in voice removes the third-party-tool barrier; one community (the K-pop moment) flooded lobbies overnight |
| What does not fit our audience or context—and why | Not playable alone — you wait in a lobby; discussion assumes voice or fast typing; its return came from streamer-era friend groups, and its own progression is cosmetic only | Voice needs moderation and a shared language we cannot assume in Decentraland; a long role list confuses new players in their first minute |
| What we will do differently | A solo maintenance layer for quiet hours, pictogram quick-chat instead of free text, freezing instead of killing, and daily/weekly hooks the original never had | v1 ships exactly one hidden role (the saboteur) and no voice; extra roles are our named v2 freshness source |

---

## 9. 4 Week Plan (v1 scope)

| Week | What is playable / done |
|---|---|
| 1 — Prototype definition | Greybox dock hall with 3 stations; one task minigame (wiring) playable solo |
| 2 — Core interaction + first-group test | Saboteur round works end to end (freeze, report, vote) in basic form; playtest at 4 players — our social threshold |
| 3 — Core systems refinement | Three task minigames total (wiring, valve, scan); pictogram quick-chat; shift leaderboard |
| 4 — Playable prototype, final design direction (mobile playtest) | Daily contract, streak, and ranks working; mobile playtest at 8–10 players; final look locked; Crew Night dry run booked for the live weeks |

**What keeps the experience changing after launch.**

- Without building a new level, we can change or rotate the daily contract task set every day and the round modifier every week.
- If an update is skipped, the contract rotation and the weekly board reset still create variation.
- If progression resets or creates a power gap, ranks and endorsements persist; a new or returning player can contribute or compete meaningfully within 5 minutes through the daily contract, which counts only this week's times.
- One player behaviour that would change what we build next: if quiet-hour players run shifts but never stay for a round, we will make shift results feed the next round directly.

**Not building in v1.**

1. A second map — the first cut to come back in v2 if v1 hits its numbers.
2. Extra hidden roles beyond the one saboteur (engineer, sheriff) — our named v2 freshness source.
3. Cosmetics or any shop. Standing non-goal: never tradable rewards, because trading abuse would cost more than the retention it buys.

**Top risk + fallback.**

Top risk: keeping the saboteur's identity secret while scene state is visible to clients — if a modified client can read the role, deduction dies. Fallback: role assignment and freeze checks run on a small authoritative server; if that slips past Week 3, v1 launches with rounds for trusted groups (Crew Night and friend invites) while we harden it.

---

**One last question.**

Section 4.2 — a deduction round has no natural persistence, and inventing progression that is not just a bigger number took the longest.
