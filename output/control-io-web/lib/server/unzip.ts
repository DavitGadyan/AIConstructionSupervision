import { inflateRawSync } from "node:zlib";

/** Extract one entry (first whose name matches) from a zip buffer. Stored or deflated entries only. */
export function extractFromZip(zip: Buffer, match: (name: string) => boolean): { name: string; data: Buffer } | null {
  // End of central directory record
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const csize = zip.readUInt32LE(p + 20);
    const nlen = zip.readUInt16LE(p + 28), xlen = zip.readUInt16LE(p + 30), clen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nlen).toString("utf8");
    if (match(name)) {
      const lnlen = zip.readUInt16LE(local + 26), lxlen = zip.readUInt16LE(local + 28);
      const start = local + 30 + lnlen + lxlen;
      const raw = zip.subarray(start, start + csize);
      return { name, data: method === 0 ? Buffer.from(raw) : inflateRawSync(raw) };
    }
    p += 46 + nlen + xlen + clen;
  }
  return null;
}
