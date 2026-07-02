---
name: composites
description: "Reference for the Decentraland `.composite` JSON format that declares the initial entities of a scene in `assets/scene/main.composite`. Covers the file structure, entity ID allocation, component grouping, jsonSchema rules, authoring-from-scratch vs edit mode (`inspector::Nodes`), and referencing composite entities from TypeScript with getEntityOrNullByName and getEntitiesByTag. Use when creating or editing a main.composite file, or when other skills point to the composite reference. For scaffolding a whole scene project see create-scene."
---

# Composites

This skill carries the shared composite format reference used by other Decentraland skills (`create-scene`, `add-3d-models`, `sdk-scenes`).

Read `{baseDir}/composite-reference.md` for the full specification of the `main.composite` JSON format: structure, entity ID allocation, common components, the component-grouping pattern, edit-mode rules (`inspector::Nodes`), and patterns for fetching composite entities from TypeScript.
