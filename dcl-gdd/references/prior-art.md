# Prior art — learn from existing games and implementations

Build a **usable library of mechanics and implementations for current and future transfers**,
from which the creator can choose, adapt and port: how they work, why others chose them, where
to inspect them, and what fits this game now or later. **The first playable is a selection from
the library, not its coverage limit.** When the owner requests a broad library, investigate and
preserve relevant future options even if today's build or decision does not need them. Judge
coverage against that research request; enough for the next build does not mean enough for
the library. Keep the search within the agreed focus and budget, with remaining gaps explicit.
Use concrete examples alongside design lenses. Start from the owner's intended experience and
player action; reuse supplied references without letting an earlier search limit the new question.
Before searching, read [research delivery](research-delivery.md) for saving findings during the
pass, coordinating workers and completing synthesis within the available resources.

## Offer and focus

Start when there is a useful question to investigate, even before a complete brief or core loop.
For a named predecessor, use what the owner wants to keep and change. For a mix, identify what
each influence contributes; for an existing game, start from its current gaps. Hear more of a vague
seed before proposing a large search. Revisit the offer at a meaningful design milestone: a new
direction, a substantially changed loop or an important gap that calls for different evidence.
Small clarifications continue the current discussion, not a new research offer. Explain briefly
what the new pass would resolve. These are opportunities, not mandatory stage gates. A fresh search
can be better than extending an early pass whose assumptions no longer fit. Preserve earlier findings
with their context, mark which applications no longer fit, and update the GDD's current synthesis.
Without a changed question or an owner request, keep an earlier decline in effect.

Make one concise, contextual offer. When a substantial search could help and depth is still
open, explain the useful choice in terms of this game:
- **Quick scan:** a bounded look at the most relevant leads for the current choice, with sources
  and clear gaps. Useful orientation, not a complete library or validation of every lead.
- **Deep research:** a broader library of evidence, alternatives and promising future uses,
  with closer checks of strong findings. It takes more time and tokens; multiple research
  agents can add to that cost. Explain the extra value, not only the extra effort.
The owner can choose either or continue designing without a search. Give time or token estimates
only when the available setup and comparable runs support them; otherwise describe the trade-off
without invented figures. Keep this a short choice, not a budget interview or a menu on every turn.
Use the chosen depth as scope; ask about a specific resource limit only when it would change
the next action. An unnamed numerical budget is not itself a missing owner decision.
Continue the design conversation without repeating an unanswered offer. Make each pass useful
on its own at the requested scope. Use the search map below to choose useful directions and
explain what a further pass could add. Let the owner choose that work or return to design;
more passes are optional, not the price of a useful first result. Follow the skill's
background-research rule so the interview can continue.
A direct request for a quick scan or deep research already chooses its scope: proceed without
asking that choice again. For a research request without a stated depth, use a proportionate,
bounded approach and state its scope; do not silently turn it into a large multi-agent study.
Record the chosen depth with the question in the existing research notes or decision record,
and pass both to any researcher. A quick scan keeps its coverage limits in the saved result;
a deep request keeps its agreed breadth, including future uses. Honour a decline or a request
to build; resume and small edits do not reset that choice.

Useful analogues also give leads to genre and occasion-based communities. Before interpreting
community material or recommending whether to explore an audience, read
[acquisition](acquisition.md). Offer a focused audience pass after relevant findings, not automatically after every search.
Known communities can be explored directly. Audience/channel research follows that reference's
outcome and record homes; a new playable walkthrough is useful only if the findings change play.

## Map and revisit the search

**Map directions from the game's intent before following the first search results.** Use the
experience, actions, player relationships and future uses the owner wants to explore. For each
promising direction, name the question it could answer and what it could add to the library:

- **Direct predecessors:** how the familiar actions and systems work together, including rules
  that a short description may hide. Follow their variants when those reveal a different solution.
- **Neighbouring games and genres:** how others solve a similar player problem with different
  rules. Search by the problem or experience as well as the genre: coordinating under pressure,
  understanding an agent's intention or choosing between speed and safety can cross genre boundaries.
- **Developer accounts:** why a solution was chosen, what was tried or dropped, and under which
  conditions it worked or failed. These can explain a mechanic or suggest an alternative to it.
- **Player practices and communities:** unusual strategies, mods, house rules, recurring wishes
  and workarounds. They can reveal uses and future possibilities that official feature lists miss.
  Read acquisition guidance to interpret who the observations describe; a wish alone is not demand.
- **Implementations:** repositories, examples and simulation environments where the relevant
  behaviour can be inspected. A less similar game may still supply the useful logic.

Choose the directions that fit the request; this is not a mandatory tour of every source type.
Keep a small working map in the existing research notes, including promising unexplored leads.
With delegation, use that map to give workers complementary questions rather than duplicate searches.

When the question is how this concept could stand out, use
[concept exploration](interview-moves.md#explore-different-directions) to connect the search to
different playable directions. Look for contrasting solutions to the intended experience, not
only more examples of its current genre. For a promising unusual combination, inspect design
accounts, player practices and counterexamples for why it could fit or conflict. Missing matches
in a catalogue are not evidence of novelty or unmet demand. Preserve the source conditions and
show which alternative each finding opens, weakens or changes.

**Distinguish going deeper from going wider.** Go deeper when a promising finding lacks rules,
implementation detail, provenance or a clear transfer path. Go wider when results keep repeating
one design and leave the owner few alternatives: change the player problem, neighbouring genre,
community practice or source type being explored. Several articles about the same design may
confirm it without adding another option. Explain which new choice or reusable solution the next
pass could uncover. Broaden and deepen as the evidence requires, not in a fixed sequence.

**Check uneven coverage before stopping.** Compare the library with the agreed research request:
which parts of the intended experience have only one example? Which useful directions have not
been investigated at all? What was left out only because it belongs to a later version? Distinguish
an area not searched, an inaccessible source, a weak lead and an inspected candidate that does
not fit; they call for different follow-ups. One example may be enough for a narrow question.
For a broad library, readiness of today's playable alone does not settle these gaps.

If closing a material gap could improve a current or future choice, name it and the benefit of
one focused continuation. Respect the agreed budget and the owner's stopping point. Preserve
remaining leads and limits so another pass can start from them; neither exhaustive coverage nor
another paid search is required to hand over a useful result.

## Investigate what can transfer

Map promising sources, then investigate candidates across the requested research scope.
Compare them with what the project already has. Follow relevant leads beyond the first matches;
depth need not be equal for every source, and there is no fixed link quota:

- **Games and mechanics:** identify the action, response, cooperation or progression that matters.
  Separate observed play, the owner's experience and a source's description.
- **Design decisions:** seek first-hand talks, postmortems, articles and devlogs from close
  analogues and predecessors. Capture the goal, alternatives tried or dropped, observed results
  and the developer's explanation, with a useful locator. Compare the relevant conditions with
  this game: audience, controls, player count, pace or production constraints. A matching failure
  mechanism can justify recommending a cut before building; different conditions suggest an
  adaptation or a focused check. A dropped feature is not necessarily failed design; keep an
  unstated reason unknown. Separate observations, the source's explanation and your transfer claim.
- **Implementations:** follow the strongest relevant candidate into the source that implements
  the useful behavior, its LICENSE and dependency/runtime manifest. Record the inspected
  revision; if only a moving branch is available, say so. Read the actual terms, including
  notices to retain, rather than relying on a repository badge. Check code and assets separately.
  Distinguish direct reuse, porting logic and design inspiration: a different engine can still
  supply useful logic. Report specific access limits and uninspected parts. Preserve useful
  leads with unknown terms; inspecting some files does not clear the whole repository for reuse.
- **DCL fit:** apply [platform-fit](platform-fit.md) to load-bearing adaptations. Reuse its
  bundled, scoped platform findings before opening a new support question; carry settled facts
  and remaining gaps into subagent briefs. Distinguish published releases, main and experimental
  examples from the installed scene version. Inspect the adaptation, not the same settled
  capability again. Engine-specific code is not automatically an SDK7 component.

Open the sources behind important claims. A search snippet or remembered title is a lead,
not evidence of inspecting the article or code. With unavailable tools or inaccessible sources,
say what remains unchecked and work from the material available; never imply a search or run.

For each consequential finding, connect source evidence to a proposed adaptation and its limits.
Keep those limits beside the claim in the GDD and final summary too: a recommendation stays a
recommendation, experimental support keeps its version condition, and an unchecked feature stays
unknown. Before finishing, compare consequential summaries with the inspected source, not your
earlier paraphrase.
When combining influences, examine how their pacing, controls, player roles and rules fit together.
Keep broad discovery separate from the selected scope. These are analysis prompts, not a required table.

## Use and preserve the findings

Established patterns can proceed to ordinary implementation or adaptation once chosen. Keep
normal correctness/integration checks distinct from a design experiment. Use a focused hypothesis
when resolving a meaningful uncertainty would change a decision, or the owner wants that method;
novelty is not required. Another game's success does not validate this game's feel or DCL transfer.

Follow the [record homes](hypothesis-log/files.md#record-homes): save useful implications in
`design/gdd.md`, separating source findings, your proposals and owner choices. Keep sources,
locators, intended uses and reuse limits in the existing reference library; preserve useful
material beyond the current playable. For substantial independent questions, keep separate research
documents linked from the reference library, reusing existing homes. Group by question, not by agent
or every source. The GDD holds the combined design; no separate brief is required. Review-only leaves files unchanged.

Complete gameplay research with a concrete proposal for the connected playable or the change
to the current game, and save that synthesis in the GDD when writes are allowed. Walk through one
possible play: what the player does, the visible response, what carries between its parts, and
what ends or restarts it. Check that each step is possible from the previous state under your
proposed rules: roles, positions, resources and outcomes must agree. Repair contradictions in
the proposal before presenting it; a walkthrough is a consistency check, not a playtest.
Propose missing links as your choices for discussion, while preserving
explicitly deferred decisions. This is a small coherent option, not a demand for a complete GDD.
Identify known solutions, adaptations and uncertainties that merit a focused test. A technical
spike can precede the playable without silently replacing its scope. Carry applicable sources and unresolved transfer constraints into an existing
[handoff](hypothesis-log/handoff.md). Research permission alone does not authorise a build.
