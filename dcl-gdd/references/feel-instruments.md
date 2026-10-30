# Feel instruments — optional observations and reference numbers

Load only for a concrete measurement or tuning question. A short observation may be enough;
these tools are not required for a GDD. Agree what uncertainty matters before choosing an
instrument. Keep build, device, conditions and limitations with the result. For scene controls,
apply [platform-fit.md](platform-fit.md); a book does not establish an SDK capability.

## Pick an instrument for the question

| Question | Small instrument or comparison | Limit |
|---|---|---|
| Did input register before the action changed? | If exposed, log received input, state, acceptance or rejection reason, and response together. Inspect the failed attempt. | A received/processed count gap locates a discrepancy, not its cause. Engine timestamps exclude device/display delay; local acknowledgement is not a server outcome. |
| How long from physical input to visible response? | Record input and screen together; count frames between the chosen events. Estimate ms as frames / capture fps × 1000. Repeat. | At 60 fps one frame is about 16.7 ms. Without a physical input timestamp, screen-only footage cannot bound input-to-photon latency: do not invent an error interval or call the reading a lower bound. |
| Why does stopping or turning feel different? | Plot a relevant object's position or speed over time in two versions; note input start, hold, release and state changes. | A curve describes motion, not enjoyment or the original code of a comparable game. |
| Which tuning parameter matters? | Save a baseline; vary one parameter over a safe range and restore it between comparisons. | Do not zero arbitrary physics values or destroy a working build; interactions between parameters may matter. |
| Which effect carries the sensation? | For one action, note the cue, the expectation it creates, and what is lost in a controlled comparison. | Removing essential information changes the task, not just presentation. |
| What do we admire in another game? | Observe an action, visible response, space and cues; distinguish observed behaviour from a proposed implementation. | Reverse engineering by observation is a hypothesis, not evidence of the developer's method. |
| Does tuning survive the intended space? | Reuse the action in a small selection of relevant gaps, slopes, target sizes or sightlines. | A test garden is a sample, not coverage of every level or device. |

## Interpret the trace

For movement, compare onset, sustained behaviour and settling after release. A long motion can
acknowledge input quickly; a delayed acknowledgement can feel different even at the same total
duration. Compare relationships such as stopping distance against target size or turn rate
against forward speed, rather than copying another game's absolute values.

The same input may act differently in different states. If that is confusing, expose the state
or simplify the interaction before adding more button combinations. Check touch separately;
old controller examples do not establish a good phone mapping. Test camera and object motion
within the controls actually available, not assumed access to platform avatar physics.

## Historical numerical prompts, not acceptance limits

The following passages were checked in the named local source editions. This verifies attribution,
not scientific validity, present-day hardware suitability or DCL requirements. Do not replace the
programme's separate criteria with these figures.

| Source and context | Reported orientation | Useful question / limit |
|---|---|---|
| Swink, *Game Feel* (2009), pp.36, 43–47: model of perception and real-time control | About 240 ms for a correction cycle; 100 ms continuity; discussion of motion at 10 fps | These model-based figures are not a target frame rate or a universal boundary of playable control. Inspect actual timing and experience. |
| Swink p.45, reporting Mick West on response | 50–100 ms described as responsive | Which event is timed? Compare the actual action and client; neither a pass below 100 nor a failure above it follows automatically. |
| Schell, *The Art of Game Design*, third edition, chapter 15, feedback discussion | A tenth of a second rule, illustrated by an unwanted jump anticipation delay | Does the player receive a meaningful early response? A deliberately readable wind-up is a different design question. |
| Chou, *Actionable Gamification*, chapter 10, Evolved UI | Start with two or three features, reveal more later | Try reducing overload when it exists; not a quota for controls or choices in every game. |
| Chou, chapter 13, First Major Win-State | Measure minutes to the first moment of perceived value; no universal duration supplied | What counts as value here, and did the player experience it? The author's dropout claim does not establish a per-second attrition law. |

If a creator asks for a threshold, tie a proposed criterion to the specific experiment and mark
it as proposed. Faster completion, more retries or lower delay alone cannot prove that play is
more satisfying. Do not use a single self-test as a population benchmark.

## Background

Instrument ideas informed by Swink pp.45, 83–85, 122–147, 163–170, 187, 269 and 335. Their
application here is an original practical synthesis, with safe parameter comparison and explicit
measurement limits; it is not a reproduction of book diagrams or a required seven-step procedure.
