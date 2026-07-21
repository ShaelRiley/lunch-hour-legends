# Lunch Hour Legends

Lunch Hour Legends is a browser-first micro-JRPG launcher and cartridge toolchain founded on one principle:

> The clearest bridge between classic JRPG affect and contemporary usability.

[Play the current early build](https://lunch-hour-legends.shaelriley.chatgpt.site)

## Current state

This is an early development build. It currently includes:

- the official OHRRPGCE WebAssembly player distribution;
- real OHR `.rpg` cartridge execution with SDL2 graphics and SDL_mixer audio;
- a user-gesture start gate for browser audio;
- module-scoped IndexedDB cartridge installation and persistent saves;
- local `.lhl.zip` validation with path, executable, compressed-size, expanded-size, manifest, SHA-256, and native OHR lump checks;
- a lossless native OHR lump-container parser and rebuilder;
- an explicitly labeled React interaction proof for launcher, battle, and save UX;
- a self-contained campaign-authoring prompt compiler.

Complete generated campaigns are not implemented yet. The current campaign-compiler work can safely inspect and rebuild native `.rpg` containers, but does not yet generate all maps, heroes, dialogue, battles, scripts, graphics, and audio required for a finished campaign.

## Development

Requirements: Node.js 22.13 or newer.

```sh
npm run install:ci
npm test
npm run lint
```

The test suite verifies the application contract, production build, official runtime payload, audio-gated startup, and lossless `.rpg` round trips.

## Cartridge format

An imported module is a `.lhl.zip` containing, at minimum:

```text
manifest.json
game.rpg
design.md
credits.md
validation/report.json
```

`game.rpg` must be a genuine OHRRPGCE cartridge. Executable JavaScript, WebAssembly, native libraries, shell scripts, and unsafe archive paths are rejected.

## Licensing

Lunch Hour Legends application code is released under the [MIT License](LICENSE).

The bundled OHRRPGCE player and its dependencies retain their own upstream licenses. See [`public/ohr/LICENSE-binary.txt`](public/ohr/LICENSE-binary.txt) and [`public/ohr/README-player-only.txt`](public/ohr/README-player-only.txt). The top-level MIT license does not replace those third-party terms.

OHRRPGCE is developed by James Paige, Ralph Versteegen, and the OHRRPGCE contributors. This project is not an official OHRRPGCE release.
