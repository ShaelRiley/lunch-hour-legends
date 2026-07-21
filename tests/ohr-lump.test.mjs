import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { packOhrRpg, parseOhrRpg, replaceOhrLump } from "../lib/ohr-lump.ts";

const data = new Uint8Array(await readFile(new URL("../public/ohr/ohrrpgce-game.data", import.meta.url)));
const collider = data.slice(34, 549767);

test("official collider cartridge round-trips losslessly through the OHR lump codec", () => {
  const lumps = parseOhrRpg(collider);
  assert.ok(lumps.length > 20);
  assert.ok(lumps.some(lump => lump.name.toLowerCase() === "browse.txt"));
  assert.ok(lumps.some(lump => lump.name.toLowerCase() === "archinym.lmp"));
  assert.deepEqual(packOhrRpg(lumps), collider);
});

test("OHR lump replacement preserves a valid native cartridge", () => {
  const lumps = parseOhrRpg(collider);
  const browse = lumps.find(lump => lump.name.toLowerCase() === "browse.txt");
  assert.ok(browse);
  const patched = packOhrRpg(replaceOhrLump(lumps, browse.name, browse.data));
  assert.deepEqual(parseOhrRpg(patched).map(lump => lump.name), lumps.map(lump => lump.name));
});

test("OHR lump codec rejects truncated and duplicate containers", () => {
  assert.throws(() => parseOhrRpg(collider.slice(0, 80)), /bounds|Truncated/);
  const one = parseOhrRpg(collider)[0];
  assert.throws(() => packOhrRpg([one, one]), /Duplicate/);
});
