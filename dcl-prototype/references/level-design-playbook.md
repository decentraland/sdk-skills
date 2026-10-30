# Level design — make space useful to play

Read when the current question depends on layout, movement, camera, navigation or spatial feel.
Pick a relevant move below; do not turn the page into an interview or require a whole level review.
Reuse the owner's intent. A door adjustment can stay a door adjustment.

These are our practical questions and trials, informed by selected sections of
[The Level Design Book](https://book.leveldesignbook.com/), not a summary of the book.
Follow the linked section when deeper explanation would change the next design decision.

## Where does movement break down?

For a cramped room or awkward passage, separate what happens: the avatar gets stuck, the camera
hits something, the view is blocked, or the space simply feels wrong. A scale figure in a render
does not settle these questions. Try the troublesome approach, turn and return in Explorer using
the intended camera mode. Include nearby placeholder furniture if its volume matters.

Change the relevant clearance or placement before scaling the entire building. If useful, compare
two short passage variants. Actual movement limits come from the current controller; comfortable
dimensions remain design choices. Other engines' door sizes are not DCL standards.
[Metrics](https://book.leveldesignbook.com/process/blockout/metrics)

If people will share this space, try the relevant interaction with another avatar: can both see,
approach and leave it? This is a spatial check, not proof of production networking or capacity.
Use the SDK's [preview workflow](https://docs.decentraland.org/creator/scenes-sdk7/getting-started/preview-scene).

## What can the player decide here?

At a junction or arrival, what can someone recognize, choose or investigate? Try one meaningful
connection and enough surrounding space to experience it. A paper layout can explore connections;
the playable version reveals travel, turns and visibility. A loop or shortcut is useful only when
it changes the experience the owner wants. Do not add branches just to make a map look complex.
[Flow](https://book.leveldesignbook.com/process/layout/flow)

If someone wanders, ask what they were looking for before treating it as failure. Compare a
recognizable feature, sound or visible destination with the existing version when orientation is
the problem. Deliberate uncertainty, exploration and hanging out can be the intended activity.
A visible cue does not guarantee attention, understanding or obedience.
[Wayfinding](https://book.leveldesignbook.com/process/blockout/wayfinding)

## What appears as the player moves?

Try approaching the same destination from two angles, or moving one screen of geometry that
hides it. Check the moving player's view, including looking back; a composed still is only one
view. Ask what they noticed or expected before explaining the intended reveal.
Keep light, sound or a recognizable silhouette when the question depends on that signal;
rough geometry alone may not represent the experience.
[Blockout](https://book.leveldesignbook.com/process/blockout)

If a journey drags or feels rushed, notice where movement, decisions and pauses actually happen.
Try moving an interaction closer or leaving room after a busy moment. A longer walk can offer
anticipation, conversation or empty delay; duration alone does not distinguish them.
[Pacing](https://book.leveldesignbook.com/process/preproduction/pacing)

## What is worth changing next?

**Sketch on the current build.** A screenshot with a marked route or moved wall can make the
next revision easier to discuss. Try it in the scene and compare; the drawing is a proposal,
not evidence. This does not require a new drawing tool.
[Naughty Dog's layout iteration](https://www.gamedeveloper.com/design/postmortem-naughty-dog-s-i-uncharted-drake-s-fortune-i-)

**Reuse a small building set when it helps.** Try joining a wall, corner and opening at the
intended scale before making many rooms. Check seams, passage and camera clearance in that
join. Extend the set only when the next space needs it; a one-off shape may be simpler.
[Modular kits](https://book.leveldesignbook.com/process/blockout/metrics/modular)

**Give light a job.** What should become readable, inviting or uncertain? Try changing one
light's placement around the relevant action. A visible lamp model and actual illumination
are separate things; verify both in Explorer. Do not assume another engine's lighting controls
exist in DCL. [Lighting](https://book.leveldesignbook.com/process/lighting)

**Spend detail where it matters.** For a short jam, one distinctive object or area can carry
the scene's character while nearby props stay simple. Choose it from the owner's intent,
then check whether it supports the action or competes with it. This is an option, not a required
showpiece. [Environment art](https://book.leveldesignbook.com/process/env-art)
For atmosphere-led exploration, use the [atmosphere trials](atmosphere-trials.md) as needed.

Keep the piece easy to revise: expose the few dimensions or placements being explored and reuse
existing assets where they fit; consult [scene resources](scene-resources.md) when something is
missing. No special editor or modular kit is required. Stop adding detail
when the current action is available to try; a whole village is unnecessary to investigate one
window encounter. Ask what a proposed addition contributes: action, orientation, mood or context.
A label may stand in for future content when its appearance is not being tested.
[Epic's blockout guide](https://dev.epicgames.com/documentation/en-us/unreal-engine/designer-01-project-setup-and-level-blockout-in-unreal-engine)
The owner can change direction or keep building an exploratory variant.

Record the build and what the person actually did or said. A preferred revision helps choose a
direction; if several things changed, it does not isolate the cause. A remembered route is not a
fresh player's navigation test. Use the existing exploratory or registered-test record, not a new
level-design report. [Playtesting](https://book.leveldesignbook.com/process/blockout/playtesting)

## Apply in Decentraland

Use the installed SDK skills for camera behaviour, collision, lighting and scene limits. Fit
the first playable route inside the actual scene boundary, including approaches and return paths;
check the current [scene limits](https://docs.decentraland.org/creator/scenes-sdk7/optimizing/scene-limitations)
before multiplying scenery. Implement
through the public SDK, not an underlying engine's editor or rendering features. Examples from
Unity, Godot or another engine supply design ideas, not a creator toolchain. Record the client used;
one client's result does not establish behaviour across clients. Verify
what matters in Explorer; an export, render or successful build is not a movement or visibility
pass. Do not infer working darkness, occlusion or multiplayer behaviour from another engine's
example. If a connection is unavailable, state what remains unobserved and use the existing safe
preview workflow. This playbook adds design options, not SDK permissions or a new approval gate.
