# Player feedback — design groundwork

Prepare a small design input for the feedback skill, not a second feedback workflow.
Use the current GDD, trial goal and existing questions. For a trial or observation plan, record
what the owner wants to learn and what they could observe. If player answers would help, offer
question preparation briefly and leave it pending. A direct request for questions, or acceptance
of that offer, starts drafting under the guidance below. Wording that could be put to a player
is already a draft, even when embedded as an example in another document. Until then, keep the
learning aim in the owner's terms. Respect a decline until the focus materially changes or the
owner asks. No registered hypothesis or complete GDD is needed.

## Leave a useful starting point

Record only what helps the next step:
- The current iteration and the design decision the feedback could inform.
- A few proposed questions in the player's language, using the game's actual actions.
- Who has enough experience to answer each question and a natural moment to ask it, including
  unsuccessful attempts where relevant. Apply this condition to every suggested alternative.

Reuse the author's questions and choices; distinguish proposed revisions from accepted ones.
Give a short recommendation with its reason. Keep the preparation proportionate: a few lines
in the GDD or existing trial record usually suffice. Link a separate `design/player-feedback.md`
only when the set needs its own home. Preserve earlier iterations and changed wording as history.
This step is ready when the feedback agent can understand the intent and proposed questions;
technical configuration and every survey detail need not be decided here.

## Use the feedback skill and its docs

When refining question wording or response formats, use the available feedback skill's relevant
instructions and the module's [question guide](https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/QUESTION_GUIDE.md).
Reuse their guidance and question bank selectively; keep them as the source of truth instead of
copying their workflow here. For implementation, route to the feedback skill discovered in the
target project or agent environment. If unavailable, use the module's
[README](https://github.com/decentraland/sdk7-test-scenes/blob/main/scenes/0,-1-scene-feedback/README.md)
and question guide; do not invent a skill name or require its installation just to prepare design.

Pass the GDD/trial link, questions, experience/timing conditions and chosen items to that feedback
skill or docs-guided builder. Reuse the [handoff](hypothesis-log/handoff.md) record and build/run
boundaries, not its prototype-session template. Detailed survey setup, question IDs, API/version
checks, UI, participation/repeat behavior, storage and verification belong to the feedback workflow.
Load those details when needed for the authorised task; design preparation alone authorises no
installation, scene changes or collection. Do not open configuration questions in the design
conversation unless they change the current design decision.

When results return, use the feedback guidance for reading them, then update the GDD with supported
implications. Keep player reports distinct from observed actions and existing experiment criteria;
preserve the agreed measure and threshold. Prepared questions create no results or verdict.
