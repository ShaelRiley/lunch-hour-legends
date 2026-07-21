import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const spec = await readFile(new URL("../public/lhl-authoring-spec.txt", import.meta.url), "utf8");

test("trusted title exposes exactly four primary actions in order", () => {
  const title = page.slice(page.indexOf("function Title"), page.indexOf("function Game"));
  const labels = [...title.matchAll(/<button[^>]*>(New Game|Continue|Load Module|Create Module)<\/button>/g)].map(m=>m[1]);
  assert.deepEqual(labels, ["New Game", "Continue", "Load Module", "Create Module"]);
});

test("creator text begins the compiled payload", () => {
  assert.match(page, /const payload=`\$\{text\}\\n\\n--- BEGIN AUTOMATIC/);
});

test("authoring specification is substantial and self-contained", () => {
  assert.ok(spec.length > 65_000);
  for (const marker of ["manifest.json", "ClassBudget(level)", "exactly sixteen", "72 directed", ".lhl.zip"]) assert.ok(spec.includes(marker), marker);
  const withoutUrls = spec.replace(/https?:\/\/\S+/g, "");
  assert.ok(withoutUrls.includes("DELIVERABLE CONTRACT"));
});

test("archive gate denies executable types, traversal, and oversize packages", () => {
  for (const marker of ["25*1024*1024", "names.length>500", "includes(\"..\")", "FORBIDDEN", "Missing required files"]) assert.ok(page.includes(marker), marker);
});

test("current character-map override is explicit", () => {
  assert.match(spec, /four playable heroes, one final villain, two opening-town NPCs, and two wildcard NPCs/i);
});
