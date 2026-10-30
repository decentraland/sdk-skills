# Platform fit — the playable action, not just the API

Use when shaping play or reviewing a load-bearing action. Keep the creator's intended sensation.
Use platform knowledge to open useful design options as well as resolve risky dependencies:
connect a capability to something the player could do or understand, explain when it helps,
and retain the conditions that change the design. Name the general implementation route.
Keep protocol details, identifiers, version history and diagnostics in the linked implementation
notes; read them when choosing an implementation or resolving a specific uncertainty. Explain
their consequence to the creator in player language. Preserve the supporting evidence rather
than deleting it to shorten the answer. Offer relevant possibilities, not an API tour.

## Worlds-first design

For a new game without a chosen destination, start from a self-contained experience in a World:
its own arrival, play space and session flow. This is this skill's design default, not a platform
restriction or an owner decision. Record it as a working assumption; keep a supplied deployment
choice. Use Genesis City LAND when the creator chooses it or the concept benefits from a shared
city location. A World still needs a way to reach players; plan the entry link and first playable
moment rather than relying on neighbouring foot traffic. Self-contained does not mean solo or
one scene, and does not remove SDK, hosting or client limits. Consult the
[publishing reference](platform/dcl-platform-facts.md#publishing-access-and-population)
when access, footprint or deployment affects the design.

## Player mode

Player mode is separate from optional social features. Before a design choice depends on
other players, recover how they play from the owner's material: solo, separate personal runs
in a shared space, cooperation, competition, or a mix. Reuse a clear choice. If it is unknown
and changes the current design, ask one plain question about playing together; save a deferred
answer as open rather than choosing a mode silently. Record the choice in the active design,
including which actions or outcomes are personal or shared and any known group requirement.
Several avatars being present does not establish shared gameplay or state. For shared actions,
identify what others actually receive; local feedback is not shared state. Keep the first try's
scope separate from the whole game's: a solo trial leaves future multiplayer untested, not cancelled.
When the idea depends on private or separate group play, use
[groups and private sessions](platform/dcl-capability-links.md#groups-and-private-sessions)
to distinguish finding a party, separate match rules, visibility/voice and control of entry.
Only clarify the distinction that affects the current idea; this is not a four-question survey.

## Reuse the platform answer before researching it again

Start with the game need in the bundled [capability map](platform/dcl-capability-links.md).
It routes to scene controls and presentation, inspected implementation examples, shared state,
and publishing or platform services. Read the relevant section; use it to suggest useful play
options as well as check feasibility. The map is a selected design reference, not a feature
checklist to ask the creator or a reason to load the whole platform library.
Match the claim to the intended client, SDK or library revision, deployment and action. A
documented capability can settle feasibility in that scope without proving its feel in this game.
An older filename or a new interview does not by itself invalidate inspected evidence.

**Reuse an applicable, source-backed answer; research the remaining gap.** Do not restart a platform survey
just because a previously covered capability appears in a new concept. Keep the primary source link or revision,
checked date and material limits with the answer in the project design/research record, not only
a reference to this skill. Summarizing must preserve which client was checked and whether a
capability is supported, unsupported there, or simply not established. Missing knowledge is not
evidence that a feature is absent; a client feature is not automatically scene-callable.
A documented way to implement something is an option, not proof that it is the only way.

**Reopen an established technical capability only after a reproducible failure.** Use it as an
implementation input within its recorded scope. A new project, a newer version number, an old
filename, agent doubt or a conflicting claim alone does not justify spending resources to prove
it again. When it fails reproducibly, carry the steps, expected and actual behaviour, and target
build into a focused diagnosis. Investigate that failure, not the whole platform.

A property outside the established scope is a separate question, not a reason to reopen the
known answer. For example, local avatar carry does not settle how remote avatars look on a
moving deck. Research that missing property while preserving the local answer. Unestablished
release availability and changeable service terms such as pricing or access still need their
own current evidence; they are not settled technical capabilities.

Build a platform research assignment from the remaining gap. First separate what the relevant
entries already establish from what this design still needs to know. Pass those conclusions,
their scope and entry paths (or excerpts when inaccessible), then the unanswered questions.
A topic such as camera or mobile is not itself an unanswered question. Mark established answers
as inputs to use, not questions to investigate, in assignments to researchers and builders.
Use [research delivery](research-delivery.md) for resource boundaries and saved results.
The worker searches for the missing answer or reproducible failure, including in its source-extraction
requests; opening a page for one gap need not recheck every feature on that page. Carry the
settled context to further workers under the same rule. Review returned claims for lost qualifiers
or duplicated checks; distinguish reused knowledge from new findings in the final record. This saves
repeated platform discovery without narrowing research into games, mechanics, communities or
implementations. New findings update the project's research record; maintainers reconcile a
reusable correction into these bundled entries, not a separate interviewer-persona fact list.

## Use existing SDK knowledge

For a gap in the bundled answer, use the official `sdk-skills` already available in the
workspace or agent environment: its `sdk-scenes` index routes to the relevant topic. Read the
needed capability, limitation or example; do not load every SDK skill. If unavailable, use the
[official SDK skills catalog](https://github.com/decentraland/sdk-skills) and its linked primary
docs or examples. Designing a game does not require installing those skills.

For reusable templates or gameplay examples, start with the official
[Example Scenes page](https://docs.decentraland.org/creator/tutorials-and-examples/examples),
which links to the Decentraland Studios catalog. Inspect selected examples under the same
version, client and evidence checks below.

When exploring ways to act, present information or build the play space, also look for relevant
examples in [sdk7-test-scenes](https://github.com/decentraland/sdk7-test-scenes). They can reveal
design options beyond this bundle, not just answer a known API question. Follow the game's need:
inspect the selected example's code, package version and supporting notes before proposing its
use. A directory name is a lead; a branch-specific example is not proof of stable client support.
Keep useful findings with their scope rather than repeating a full SDK survey each interview.
Compare an example's package with the relevant release notes: an old feature-build fixture may
demonstrate an API that newer documentation now supports publicly. Conversely, a dependency
range or `latest` does not establish the version actually run. Keep the documented capability
and the inspected example's conditions separate; test labels and expected results in source
are not observations from running it.

Keep the layers distinct: this skill gives a **designer answer** — what the player can do,
under which conditions, and what the scene must implement. SDK skills supply implementation
detail when needed. Reading that detail during a design-only interview does not start their
scene-editing workflow or its build approvals. Preserve useful ready-made implementations and
workarounds as candidates with their integration needs, not as finished features of this game.

An official source or an installed copy is not automatically current for the target. Keep its
known version, client and evidence scope; an unknown revision stays unknown. Apply the reuse
rule above to remaining gaps or reproducible failures, checking the specific question rather than
repeating the whole survey. Pass the same source paths and qualifiers to delegated researchers.

## Check the action

Trace one repetition: **player input → what the scene controls → visible/audible response →
what the player can notice and choose next**. Account for the actual camera, avatar and target
client, including touch. The existence of an animation, attachment or camera API does not prove
that their combination delivers precise hand interaction, a readable close-up or good control.

Distinguish a built-in client feature from an API the scene can call, custom scene/asset/server
work, and an unverified dependency. Resolve load-bearing gaps with the reuse rule above;
specific official docs or inspected implementation settle only the claim they actually cover.
Identify which verified feature or existing implementation supplies a dependency, keeping its
SDK/client version and test conditions with the claim when known. Separate a verified limit in
that context from an unknown capability and an untested workaround; neither the limit nor the
workaround establishes what every implementation can do. A built-in capability can support
feasibility, not zero integration or testing work. Qualifiers such as
"probably free" still claim effort; without a basis, describe the work and uncertainty instead.
Do not label something impossible because it is undocumented, or cheap because it is possible.
This applies to every offered alternative, not only the owner's original idea: device support,
scene-callable control and experienced quality are separate claims. An apparently simple sound,
object effect or camera change still has integration, performance and client dependencies.
Before calling a design robust, try a counterexample to the claimed protection: a player holds
control, reacquires it, leaves, or joins after a busier session. A rule handling one transition
does not establish the broader guarantee. State what it handles and leave the rest unverified.

Explain the consequence in player language: what works, what is uncertain, and what changes in
feel or effort. Treat an owner-suggested workaround as a candidate: record what it could preserve and the
smallest check it needs, without claiming it works. When a workaround changes the core sensation,
offer the trade-off to the owner; do not quietly replace their idea. A simpler presentation can
be a candidate, not a forced answer.
Keep API names in the evidence/experiment notes, not as homework for the creator.

An unresolved dependency remains `TBD:` with a focused check, not a promised feature or an
ordinary later-version cut. Test the smallest risky interaction in the intended client before
calling its feel proven. Documentation alone can support feasibility, never experienced quality.
Use the existing hypothesis workflow; no new report or checklist is required from the owner.

Also ask whether the design fits how people enter, leave, observe and control play here. A genre
need not be unique to Decentraland. In the Creator Success route, preserve interesting solo play;
another player should improve it. General design follows its intended population: an intentionally
group-only experience is valid. In either case, verify any load-bearing invite, matchmaking or
minimum-crowd assumption rather than treating it as an available rescue plan.
Do not add wearables, rewards or social systems merely to make the game look platform-specific.
