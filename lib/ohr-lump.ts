/** Lossless reader/writer for the native OHRRPGCE lumped .rpg container. */
export type OhrLump = Readonly<{ name: string; data: Uint8Array }>;

export type ParseOhrOptions = Readonly<{
  maxBytes?: number;
  maxLumps?: number;
}>;

const SAFE_NAME = /^[A-Za-z0-9_.-]+$/;

function readPdp32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 16) | (bytes[offset + 1] << 24) | bytes[offset + 2] | (bytes[offset + 3] << 8)) >>> 0;
}

function writePdp32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 16) & 255;
  bytes[offset + 1] = (value >>> 24) & 255;
  bytes[offset + 2] = value & 255;
  bytes[offset + 3] = (value >>> 8) & 255;
}

function validateName(name: string) {
  if (!name || name.length > 50 || !SAFE_NAME.test(name)) throw new Error(`Invalid OHR lump name: ${name || "(empty)"}`);
}

export function parseOhrRpg(input: Uint8Array, options: ParseOhrOptions = {}): OhrLump[] {
  const maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
  const maxLumps = options.maxLumps ?? 4096;
  if (input.byteLength === 0) throw new Error("OHR cartridge is empty.");
  if (input.byteLength > maxBytes) throw new Error(`OHR cartridge exceeds ${maxBytes} bytes.`);
  const decoder = new TextDecoder("ascii", { fatal: true });
  const seen = new Set<string>();
  const lumps: OhrLump[] = [];
  let cursor = 0;
  while (cursor < input.byteLength) {
    if (lumps.length >= maxLumps) throw new Error(`OHR cartridge exceeds ${maxLumps} lumps.`);
    const nameStart = cursor;
    while (cursor < input.byteLength && input[cursor] !== 0 && cursor - nameStart <= 50) cursor++;
    if (cursor >= input.byteLength) throw new Error("Truncated OHR lump name.");
    const name = decoder.decode(input.subarray(nameStart, cursor));
    validateName(name);
    cursor++;
    if (cursor + 4 > input.byteLength) throw new Error(`Truncated size for OHR lump ${name}.`);
    const size = readPdp32(input, cursor);
    cursor += 4;
    if (size > input.byteLength - cursor) throw new Error(`OHR lump ${name} exceeds cartridge bounds.`);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate OHR lump name: ${name}`);
    seen.add(key);
    lumps.push({ name, data: input.slice(cursor, cursor + size) });
    cursor += size;
  }
  return lumps;
}

export function packOhrRpg(lumps: readonly OhrLump[]): Uint8Array {
  if (!lumps.length) throw new Error("Cannot pack an OHR cartridge without lumps.");
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  let total = 0;
  const prepared = lumps.map(lump => {
    validateName(lump.name);
    const key = lump.name.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate OHR lump name: ${lump.name}`);
    seen.add(key);
    const name = encoder.encode(lump.name);
    if (lump.data.byteLength > 0x7fffffff) throw new Error(`OHR lump ${lump.name} is too large.`);
    total += name.byteLength + 1 + 4 + lump.data.byteLength;
    if (!Number.isSafeInteger(total) || total > 64 * 1024 * 1024) throw new Error("Packed OHR cartridge exceeds 64 MB.");
    return { name, data: lump.data };
  });
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const lump of prepared) {
    output.set(lump.name, cursor);
    cursor += lump.name.byteLength;
    output[cursor++] = 0;
    writePdp32(output, cursor, lump.data.byteLength);
    cursor += 4;
    output.set(lump.data, cursor);
    cursor += lump.data.byteLength;
  }
  return output;
}

export function replaceOhrLump(lumps: readonly OhrLump[], name: string, data: Uint8Array): OhrLump[] {
  const key = name.toLowerCase();
  let replaced = false;
  const next = lumps.map(lump => {
    if (lump.name.toLowerCase() !== key) return lump;
    replaced = true;
    return { name: lump.name, data: data.slice() };
  });
  if (!replaced) throw new Error(`OHR lump not found: ${name}`);
  return next;
}
