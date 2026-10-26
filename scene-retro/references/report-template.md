# Retro report template

The reader is a maintainer of the Decentraland SDK skills who never saw the sessions. Every entry has to stand on its own.

## Evidence labels

Tag each claim with one or more labels, specific to that claim:

- **[in-world]**: a recorded Explorer observation, screenshot, runtime state, log, or exercised interaction.
- **[source]**: skill text, implementation, typings, saved scene data, build output, or a test result.
- **[reported]**: only the owner or another person reported it.
- **[unverified]**: the interpretation or proposed generalization still needs confirmation.

## Structure

### Header

1. **Scope:** the scene, the period covered, and which sessions and records were reviewed versus unavailable. Mark primary records versus summaries.
2. **Evidence legend:** the four labels above.
3. **Skill map:** a compact table of the skills most in need of correction or improvement, with one line each on why.

### 1. Incorrect or missing facts that caused a wrong first attempt

Name the skill, section or reference example. Explain what guidance led to the attempt, what happened, and the correction needed. For an omission, name the missing prerequisite or decision, not just "more documentation would have helped".

### 2. Generalizable gotchas and corner cases

For each one: the symptom, the conditions it needs, the investigation, and the fix or workaround. Say exactly what was verified after the change. Keep a temporary workaround separate from the recommended long-term pattern.

### 3. Avoidable investigation and iteration

Repeated checks, false starts, or unnecessary implementation work that a short instruction could have prevented. Propose the actual sentence, example, cross-link or diagnostic step to add. Don't invent token counts or savings estimates.

### 4. Corrections the owner had to make that the agent could have caught

Include mistakes the agent later caught itself. For each, say which existing instruction, source inspection, schema check or runtime verification would have caught it, and whether the skill needs a change or the agent simply failed to apply it.

### 5. Claims that remain doubtful or unverified

Name the claim, explain the conflicting or insufficient evidence, and propose the smallest useful test.

### Appendix: skill use

A small table: skill, bucket (invoked/loaded, partial read, located only, installed with no evidence of use, relevant in hindsight), when it was consulted relative to the failure, access method, and a local evidence reference (transcript file and line or timestamp, commit hash). No full transcript excerpts.

## Entry format

Each substantive finding makes these six points clear, in prose or as a short list:

1. **Skill:** which SDK skill or reference file should change.
2. **Consulted:** whether and when the agent read it, relative to the failure.
3. **Symptom:** the concrete failed attempt or symptom.
4. **Evidence:** what the evidence establishes, with labels.
5. **Fix:** what fixed it, and how that result was checked.
6. **Proposed change:** the documentation change, ideally as the sentence or example to add.

Add the classification (incorrect guidance, missing guidance, discoverability, agent error, platform defect, unverified hypothesis) next to the title.

Illustrative entry (shows the format; the facts come from `add-interactivity`):

> **Hover outline lit up the whole parent model** (missing guidance)
> 1. Skill: `add-interactivity`, section on pointer events.
> 2. Consulted: loaded before the first attempt.
> 3. Symptom: hovering one drawer highlighted the entire cabinet.
> 4. Evidence: [in-world] screenshot of the outlined cabinet; [source] `PointerEvents` was on the parent entity.
> 5. Fix: moved `PointerEvents` to the child entity; re-checked by hovering in the Explorer [in-world].
> 6. Proposed change: "The hover outline covers every mesh under the entity that holds `PointerEvents`. Put it on the smallest entity that should glow."
