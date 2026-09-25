import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * File storage. Local disk by default (STORAGE_DIR). Keys are opaque,
 * content-addressed-ish paths; every stored file carries its SHA-256 so a
 * report can prove the evidence was not altered after capture.
 * Swap `put`/`get` for an S3 client in production - nothing else touches disk.
 */
const root = () => path.resolve(process.env.STORAGE_DIR ?? "./storage");

export function sha256(buf: Buffer | Uint8Array) {
  return createHash("sha256").update(buf).digest("hex");
}

export async function put(prefix: string, filename: string, data: Buffer | Uint8Array) {
  const ext = path.extname(filename).toLowerCase() || ".bin";
  const key = `${prefix}/${randomUUID()}${ext}`;
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return { key, sha256: sha256(data), size: data.byteLength };
}

export async function get(key: string) {
  const full = path.join(root(), key);
  if (!full.startsWith(root())) throw new Error("bad key");
  return readFile(full);
}

export async function exists(key: string) {
  try {
    await stat(path.join(root(), key));
    return true;
  } catch {
    return false;
  }
}

export function fileUrl(key: string) {
  return `/api/files/${key}`;
}

export function contentTypeFor(key: string) {
  const ext = path.extname(key).toLowerCase();
  return (
    { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf", ".glb": "model/gltf-binary" } as Record<string, string>
  )[ext] ?? "application/octet-stream";
}
