import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseOhrRpg } from "../lib/ohr-lump.ts";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const wrapper = await readFile(new URL("../public/ohr/lhl-player.html", import.meta.url), "utf8");
const source = await readFile(new URL("../games/cavebabe.hss", import.meta.url), "utf8");
const game = new Uint8Array(await readFile(new URL("../public/games/cavebabe.rpg", import.meta.url)));

test("Cavebabe is the real default native cartridge", () => {
  for (const marker of ["DEFAULT_CAVEBABE", "Cavebabe: Wheel of Fire", 'builtin: "cavebabe"', "/cavebabe-key-art.svg"]) assert.ok(page.includes(marker), marker);
  assert.ok(!page.includes("REFERENCE MODULE"));
  assert.ok(!page.includes("THE GRAND RESONANCE AUDITORIUM"));
});

test("title presentation follows active module metadata", () => {
  const title = page.slice(page.indexOf("function Title"), page.indexOf("function Game"));
  for (const marker of ["module.coverArt", "module.artLocation", "module.title.toUpperCase()", "module.levelRange"]) assert.ok(title.includes(marker), marker);
});

test("wrapper mounts repository-shipped ROMs outside the Emscripten diagnostic bundle", () => {
  for (const marker of ["externalBuiltin", "/workspace/lhl-builtins/", "LHL_BUILTIN", "fetch(`/games/${encodeURIComponent(safeBuiltin)}.rpg`)"]) assert.ok(wrapper.includes(marker), marker);
});

test("Cavebabe cartridge is native, complete, and source-backed", () => {
  const lumps = parseOhrRpg(game);
  assert.ok(game.byteLength > 700_000);
  assert.ok(lumps.length >= 59);
  const hsp = lumps.find(lump => lump.name.toLowerCase() === "ohrrpgce.hsp");
  assert.ok(hsp);
  const compiled = new TextDecoder("latin1").decode(hsp.data).toLowerCase();
  for (const marker of ["cavebabe", "wheel of fire", "stonewheel run", "tarpit showdown", "ending screen"]) assert.ok(compiled.includes(marker), marker);
  for (const marker of ["cave hunt", "stonewheel run", "tarpit showdown", "ending screen"]) assert.ok(source.includes(marker), marker);
});
