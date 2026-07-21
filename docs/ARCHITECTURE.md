# Architecture

The proof separates the shell, deterministic game state, module boundary, persistence, and authoring prompt.

1. **Shell:** four title actions and active-module metadata.
2. **Runtime proof:** a fixed trusted room and deterministic battle state machine.
3. **Persistence:** browser-local, namespaced by module ID; three manual slots plus autosave.
4. **Module gate:** ZIP inspection occurs in memory; the active module changes only after a successful report and an explicit Activate action.
5. **Prompt compiler:** exact creator text + delimiter + embedded static authoring specification; SHA-256 stamps the compiled payload.

Imported metadata can be activated in this spike, but imported `game.rpg` execution awaits the pinned OHRRPGCE WASM runtime milestone.
