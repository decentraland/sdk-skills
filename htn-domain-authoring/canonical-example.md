# Add a canonical example

This route is for contributions in the full HTN source checkout, not ordinary consumer authoring.
For game-owned cases use the consumer testing guide through [module-reference.md](module-reference.md).

A canonical example is a published HTN example re-expressed as a paper prototype under
`scenes/96,-11-htn-planner/src/examples/canon/`: a domain, scenarios, stories, one small TS file, nothing to
register for the scenarios. The format and its commands:
[htn-examples-catalog.md, "Canonical examples"](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/htn-examples-catalog.md#canonical-examples--srcexamplescanon).
Write the domain with the steps of [SKILL.md](SKILL.md); these steps add what the canon needs.

1. **The domain**: `src/examples/canon/<example>/<stem>.domain`, `<stem>` unique across the examples (it is the
   station's id). Its header, before `(:domain`, has one line starting with each field:
   - `// Teaches:` the lessons, each with the rule number it follows;
   - `// Source:` author, title, URL, the commit or edition, the file and the method names you took;
   - `// Licence:` the source's licence and how you used it: `re-expressed (nothing copied)`, or `MIT (adapted)` with
     the notice added to `src/examples/canon/THIRD_PARTY_NOTICES.md`;
   - `// Deviations:` what differs from the source and why (an emulated missing feature counts: effects,
     `!continue`, `:sort-by`, costs);
   - `// Not ported:` what you left out.

   Then the facts it reads with their writers (host sensor, executor) and `// Primitives:`. Done when
   `test/examples/canon/canon.test.ts` passes the header check.
2. **The host profile**: put the domain's primitives in its `htn-lint.json` override (`"files"`, `"primitives"`,
   `"bookkeeping"` for upkeep); enable `"rules": { "missing-contract": "error" }` for the authored domain.
   After inspecting the lint report for a new shipped example or an intentional finding/metric change, run
   `npm run htn:lint -- --update-baseline` in this source checkout and review
   `test/tools/htn-lint.baseline.json`. Accept only explained changes, never refresh a baseline to hide a defect.
   Done when lint passes and baseline changes are explained;
   a deliberate source shape may carry a justified suppression. The contract check verifies comments, not behaviour.
3. **The scenarios**: files `src/examples/canon/<example>/worlds/<stem>/<n>_<what>.worldstate`, numbered in
   reading order (two digits from 10 on). Header: a line saying what the world shows, `// method: <name> [args]`,
   `// expect: succeeded|no_plan` and the numbered steps exactly as `npm run htn:run` prints them; then the facts,
   sensed facts written out (a scenario is the world the planner sees). The current catalogue suite requires the
   same plan with branch backtracking off. Keep intentionally mode-dependent source comparisons in example-specific
   tests (step 5), with expected results per mode; a documented exception alone does not bypass the suite.
   Follow "Independent scenarios" in [SKILL.md](SKILL.md): write complete expected status/steps and the reason
   from the source or strategy before the first execution. Never paste actual output as the oracle or fill a
   placeholder from it. Then run `npm run -s htn:run -- --world <stem>/<scenario>`.
   Done when every required entry/near-miss/re-entry case compares against an independent expectation and passes;
   `expected: same` alone does not establish that the expectation was correct. Add applicable host consistency
   rules as `<stem>.invariants.domain` ([format](https://github.com/decentraland/sdk7-test-scenes/blob/122a3ff2e87b7e89a6c6ea415eb140dd51716125/scenes/96,-11-htn-planner/docs/htn-world-invariants.md)); the catalogue and stories discover
   it automatically. Include its header fields, an empty primitive list and check names in the lint profile
   (`checkMethods`); no unconditional fallback. Test both accepted and rejected worlds.
4. **The stories**: `src/examples/canon/<example>/stories.ts` with the scripted host (a `PaperHost`: the facts each
   executor writes, what a failure leaves, step durations, sensors; only primitives `htn-lint.json` lists) and
   stories that replay the lesson over replans: `story({ station, name, blurb, from: '<scenario>' | facts, method,
   host, events, fails, until, maxSteps, show, expect: <independently derived trace> })` for one agent, or a `play(stage)` script for several
   (`stage.agent`, `tick`, `run`, `stage.event`, `matches`, `show`). Add them to `CANON_STORIES` in
   `src/examples/canon/index.ts`. Interacting agents need a shared-host story: include the relevant contention,
   handoff and interruption, with progress or deliberate termination for each agent. Before executing it, derive
   expected outcomes and an exact trace from the strategy/host schedule; if exact formatting is impractical, put
   independent semantic assertions in a test. A captured trace may supplement those assertions, never replace them.
   Run `npm run -s htn:run -- --story <stem>/<story>` and diagnose mismatches instead of copying the output into
   `expect`. Done when independent checks pass and the trace demonstrates the lesson, not merely a deadlock-free log.
5. **Lessons a trace cannot show** (a source shape that fails in some mode, a golden plan, a legality check): a test
   in `test/examples/canon/<example>.test.ts` using `test/examples/canon/helpers.ts`.
6. **Check and list.** `npm test`, `npm run -s htn:lint -- src/examples/canon`, then add a row to the source catalogue's table
   and to [examples.md](examples.md) under each pattern it shows.
   Done when both commands pass, source/licence notices are preserved, and catalogue entries resolve.
