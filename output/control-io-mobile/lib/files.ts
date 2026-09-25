/**
 * Opening and sharing authenticated files (report and document PDFs).
 *
 * Files need the bearer token, so nothing is opened by bare URL:
 *  - iOS / Android: download into the cache (idempotent per file id), then the
 *    system share sheet, which also offers Quick Look / "Open with".
 *  - Web: fetch with the token and hand the browser a blob URL. The tab is
 *    opened synchronously inside the tap so pop-up blockers allow it.
 */
import { Linking, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { absoluteUrl, authHeaders } from "./api";

/** Anything with an id and a server path: Report, report/document summaries, ProjectDocument. */
export interface RemoteFile {
  id: string;
  url: string;
}

export interface FileOptions {
  /** download name without path, e.g. "INS-2026-0007.pdf" (sanitised) */
  name?: string;
  mimeType?: string;
  /** iOS uniform type identifier */
  uti?: string;
  /** Android share-sheet title */
  dialogTitle?: string;
}

const PDF = { mimeType: "application/pdf", uti: "com.adobe.pdf" } as const;

function safeName(name: string) {
  const cleaned = name.replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-");
  return cleaned || "control-io-file";
}

function withExt(name: string, ext: string) {
  return name.toLowerCase().endsWith(ext) ? name : `${name}${ext}`;
}

/** Native: download into the cache and return the local file URI. */
export async function downloadToCache(path: string, token: string, name: string): Promise<string> {
  const url = absoluteUrl(path);
  if (!url) throw new Error("This file has no download link.");
  const dest = new File(Paths.cache, safeName(name));
  const file = await File.downloadFileAsync(url, dest, { headers: authHeaders(token), idempotent: true });
  return file.uri;
}

async function fetchBlob(path: string, token: string): Promise<Blob> {
  const url = absoluteUrl(path);
  if (!url) throw new Error("This file has no download link.");
  let res: Response;
  try {
    res = await fetch(url, { headers: authHeaders(token) });
  } catch {
    throw new Error("Can't reach the server to download the file. Check your connection.");
  }
  if (!res.ok) throw new Error(res.status === 404 ? "The file is no longer available." : `Download failed (${res.status})`);
  return res.blob();
}

function webDownload(blobUrl: string, name: string) {
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const revokeLater = (u: string) => setTimeout(() => URL.revokeObjectURL(u), 60_000);

/**
 * Open a file for reading. Web: new tab; native: share sheet (Quick Look /
 * "Open with" live there).
 */
export async function openFile(path: string, token: string, opts: FileOptions = {}): Promise<void> {
  const name = safeName(opts.name ?? "control-io-file");
  if (Platform.OS === "web") {
    // open the tab now, while we are still inside the tap's user gesture
    const tab = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const blob = await fetchBlob(path, token);
      const blobUrl = URL.createObjectURL(blob);
      if (tab && !tab.closed) tab.location.href = blobUrl;
      else webDownload(blobUrl, name);
      revokeLater(blobUrl);
    } catch (e) {
      tab?.close();
      throw e;
    }
    return;
  }
  await shareFile(path, token, opts);
}

/**
 * Share a file. Native: share sheet. Web: the Web Share API with the file
 * when the browser supports it, otherwise a download.
 */
export async function shareFile(path: string, token: string, opts: FileOptions = {}): Promise<void> {
  const name = safeName(opts.name ?? "control-io-file");
  if (Platform.OS === "web") {
    const blob = await fetchBlob(path, token);
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { canShare?: (d: ShareData) => boolean }) : null;
    try {
      const file = new globalThis.File([blob], name, { type: opts.mimeType ?? blob.type });
      if (nav?.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: opts.dialogTitle ?? name });
        return;
      }
    } catch (e) {
      // user closed the share sheet: done; anything else falls back to a download
      if (e instanceof Error && e.name === "AbortError") return;
    }
    const blobUrl = URL.createObjectURL(blob);
    webDownload(blobUrl, name);
    revokeLater(blobUrl);
    return;
  }
  const uri = await downloadToCache(path, token, name);
  if (!(await Sharing.isAvailableAsync())) {
    await Linking.openURL(uri);
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType: opts.mimeType,
    UTI: opts.uti,
    dialogTitle: opts.dialogTitle,
  });
}

export interface PdfOptions {
  /** "report" (default) or "document": picks the file name and share title */
  kind?: "report" | "document";
  /** human title for the share sheet and file name, e.g. "Building Permit BP-0417" */
  title?: string;
}

function pdfOptions(file: RemoteFile, o: PdfOptions): FileOptions {
  const kind = o.kind ?? "report";
  const base = o.title ? safeName(o.title) : `control-io-${kind}-${file.id}`;
  return {
    ...PDF,
    name: withExt(base, ".pdf"),
    dialogTitle: o.title ?? (kind === "report" ? "Share inspection report" : "Share document"),
  };
}

/** Open a report / document PDF (web: new tab; native: share sheet). */
export async function openPdf(file: RemoteFile, token: string, opts: PdfOptions = {}): Promise<void> {
  await openFile(file.url, token, pdfOptions(file, opts));
}

/** Share a report / document PDF. */
export async function sharePdf(file: RemoteFile, token: string, opts: PdfOptions = {}): Promise<void> {
  await shareFile(file.url, token, pdfOptions(file, opts));
}
