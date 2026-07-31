import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const data = new Uint8Array(await readFile("public/ohr/ohrrpgce-game.data"));
const collider = data.slice(34, 549767);
const outDir = "analysis-collider";
await mkdir(outDir, { recursive: true });

function readPdp32(bytes, offset) {
  return ((bytes[offset] << 16) | (bytes[offset + 1] << 24) | bytes[offset + 2] | (bytes[offset + 3] << 8)) >>> 0;
}

const decoder = new TextDecoder("latin1");
const lumps = [];
let cursor = 0;
while (cursor < collider.length) {
  const start = cursor;
  while (collider[cursor] !== 0) cursor++;
  const name = decoder.decode(collider.slice(start, cursor));
  cursor++;
  const size = readPdp32(collider, cursor);
  cursor += 4;
  const bytes = collider.slice(cursor, cursor + size);
  cursor += size;
  lumps.push({ name, size, bytes });
  await writeFile(join(outDir, name), bytes);
}

const printable = lumps.map(({ name, size, bytes }) => {
  const text = decoder.decode(bytes);
  const chars = [...text].filter(ch => {
    const code = ch.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
  }).length;
  const ratio = bytes.length ? chars / bytes.length : 0;
  const strings = text.match(/[ -~]{4,}/g)?.slice(0, 80) ?? [];
  return { name, size, printableRatio: Number(ratio.toFixed(3)), strings };
});

await writeFile(join(outDir, "report.json"), JSON.stringify({ cartridgeBytes: collider.length, lumpCount: lumps.length, lumps: printable }, null, 2));
console.log(`Extracted ${lumps.length} lumps from ${collider.length} bytes.`);
