import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../public/ohr/", import.meta.url);
const wrapper = await readFile(new URL("lhl-player.html", root), "utf8");
const build = await readFile(new URL("buildinfo.ini", root), "utf8");

test("official OHRRPGCE WASM distribution is present", async () => {
  assert.ok((await stat(new URL("ohrrpgce-game.wasm", root))).size > 4_000_000);
  assert.ok((await stat(new URL("ohrrpgce-game.data", root))).size > 8_000_000);
  assert.match(build, /build_date=20260512/);
  assert.match(build, /svn_rev=14297/);
});

test("wrapper uses native cartridge arguments, IDBFS, and a user audio gesture", () => {
  for (const marker of ["ohrrpgce_arguments.txt", "FS.mount(IDBFS", "lhl:mount-cartridge", "noInitialRun: true", "START OHRRPGCE · ENABLE AUDIO", "callMain([gamePath])"]) assert.ok(wrapper.includes(marker), marker);
});
