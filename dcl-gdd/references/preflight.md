# Preflight — P1–P9

Creator Success proposal route only: load at phase 0; repeat in phase 3.
For general design, check the chosen experience and actual claims through
[review-lens.md](review-lens.md); this table does not supply missing goals or requirements.
Report hits and useful next moves, never a total score or
predicted funding verdict. Keep check IDs backstage; the programme decides submissions.

Problems worth naming early, because they are cheaper to fix early. These rows are the merged
checklist's preflight, one for one; the letters are internal shorthand for you.

Apply these project rules when interpreting a gap; they are working guidance, not verbatim
quotations of programme terms:

- an untested claim is acceptable when the planned test is credible;
- a working draft can begin without a build; actual V0 submission needs the test scene described
  in [funding and scope](funding-and-scope.md);
- a short contextual hint or optional help is **not** a blocker.

| # | Check | Not ready looks like |
|---|---|---|
| P1 | **Core game** (§3) | A theme, a story or a feature list, but never what the player repeatedly *does*. No loop completion, no outcome, no named source of fresh play. Waiting or queues standing in for the loop belongs here too — the "loop" turned out to be a timer, and waiting became the gameplay. |
| P2 | **Program fit** (§1, §5) | No worthwhile experience for a lone arrival, or no concrete way others improve it. Mere solo survival and a waiting/invite screen do not meet Fun alone. Async traces or visible co-presence can contribute, but do not automatically prove either half ([solo](social-design.md#solo-means-worthwhile-not-merely-possible)). |
| P3 | **First-use clarity** (§2) | The first minute is not understandable — the 5/10 rule fails. The failure is **incomprehension, not the presence of text**: the teaching order is visible affordance → short contextual hint → optional help. (a blanket ban on reading, signs and tutorial NPCs was rejected — D-08; do not restore it). |
| P4 | **Return theory** (§4) | No concrete D1 hook, no persistent first-week change, no testable return hypothesis — or the only theory is "the game is fun" / "there will be more content". |
| P5 | **Mobile path** (§6) | A desktop-only interaction model with no touch plan: mouse-precision aiming, keyboard combos, hover states. Performance unmentioned. Desktop evidence offered for a mobile claim. |
| P6 | **v1 scope** (§9) | Scope obviously beyond four build weeks — "an MMO", "10 minigames", progression plus housing plus pets in v1. Cuts that remove nothing. A complete loop that depends on unspecified later features. |
| P7 | **Name, IP, policy & deployment** (header, §7) | Known or unresolved rights/policy concerns in public game, scene or World names, branding or used content; deployment permission unclear. Inspiration alone is not a violation. Follow the [IP self-check](scope-and-evidence.md#ip-and-content-declaration--now-a-header-self-check); record uncertainty rather than assuming clearance. |
| P8 | **Submission evidence** (§0) | A claimed link that does not open, or does not match the stated stage. A draft may have no build and remain untested; before an actual V0 submission, name the missing deployed test scene as unfinished application work. |
| P9 | **Platform feasibility** (§3, §5) | The promised interaction or fallback depends on scene control that is unsupported or unverified on the target client. Apply [platform fit](platform-fit.md): distinguish client features, scene APIs and custom work. Unknown means a focused check, not impossible or ready to ship. |

Distinguish **absence** (the section was never asked → an interview target) from a **structural
miss** (the design refuses the requirement — *"players wait in a queue for their turn"* *is* the
design → the one thing to decide before more writing). On hobbyist documents in Adapt or Solidify,
P4 and P2 burn by absence almost every time; closing them **is the interview**, not a verdict on it.

**Stage matters.** P4 (return) and P2's social half judge the *submitted* GDD, and their sections
become real at stage 2 ([stages-and-gates.md](stages-and-gates.md)). At stage 1, establish the intended worthwhile solo moment and note the social enhancement;
leave detailed social systems for later. Neither intention is proof of enjoyment.
