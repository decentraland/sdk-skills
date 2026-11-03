# Inside the Creator Hub's AI assistant: what a prompt can carry

Applies only when you run as the Creator Hub's embedded assistant. Two channels deliver files and assets with a prompt, besides the text.

## Files the user attaches to a prompt

The user can attach files to a turn: the **Attach files** paperclip left of the composer input opens a multi-select picker, files can be dropped onto the composer (overlay: *Drop files to attach*), and images can be pasted from the clipboard. Attachments appear as removable chips; **8 per prompt** is the cap.

- **A file picked or dropped from disk arrives as its real absolute path**: no copy, no base64 round-trip, no size cap. Read it in place, without asking the user to re-paste its contents or move it into the project. A pasted (clipboard) image has no path, so the app writes it to a temp file and hands you that path instead.
- **Any file type is accepted.** The app classifies it only for the chip icon: `image` (png, jpg, jpeg, gif, webp, bmp, svg, avif), `model` (glb, gltf), `audio` (mp3, wav, ogg, m4a, flac), `file` for everything else.
- **This is the natural way to hand over a reference image or a GLB.** A dropped `.glb` is a model the user wants in the scene: it is still outside the project, so copy it under `assets/Models/` before referencing it from `GltfContainer` (see **add-3d-models** for the bounding-box and collider audit). A reference image is usually art direction for a UI or material, not a file to import.
- A prompt may arrive with **attachments and no text at all**: the attachment is the request. Ask what to do with it.

## Assets the user mentions from the Local Assets panel

**Double-clicking an asset in the inspector's Local Assets panel** (tree or card) attaches it to the next prompt as a chip, next to the entity selection. Several assets plus the current selection can ride on one prompt; mentions clear after sending or when the chat closes. The asset arrives in the turn as `[Editor context]`:

- A mentioned **file** comes as a project-relative path that already exists in the scene: reference it directly, as it is.
- A mentioned **built-in avatar animation** comes as a *name*, not a path, and has no file. Play it with `triggerEmote({ predefinedEmote: '<name>' })` (see **avatar-animations**).
- A chip is a pointer, not an instruction. "This one" plus a chip still needs a verb: ask if the request is ambiguous.
