# Lunch Hour Legends

A browser-first micro-JRPG technical spike built around one founding principle: **the clearest bridge between classic JRPG affect and contemporary usability.**

## Implemented in this proof

- Exactly four trusted title actions: New Game, Continue, Load Module, Create Module.
- A keyboard/touch explorable room and deterministic four-hero battle.
- Three module-scoped manual save slots plus a rotating safe-node autosave.
- Local `.lhl.zip` inspection with fail-closed path, file-count, size, type, package-tree, and manifest checks; activation is always explicit.
- A self-contained Create Module prompt builder whose first character is the creator's exact request.
- Responsive SNES-modern interface with a restrained arcade-terminal texture.

## Boundary of the proof

The playable room and battle establish launcher, input, battle, save, Continue, validation, and authoring-prompt contracts. OHRRPGCE WebAssembly execution, the full compiler/simulator, complete canonical adventure, art/audio generators, and public module gallery are later milestones.

Run `npm run install:ci`, `npm test`, or `sites-preview start "$PWD"` from this directory.
