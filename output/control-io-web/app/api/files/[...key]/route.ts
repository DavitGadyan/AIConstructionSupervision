import { apiError, HttpError, projectForSession, requireApiSession } from "@/lib/server/auth";
import { contentTypeFor, get } from "@/lib/server/storage";

/** Streams a stored file after checking the caller's org can read its project. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const s = await requireApiSession(req);
    const { key: parts } = await params;
    const key = parts.join("/");
    if (key.includes("..")) throw new HttpError(400, "Bad path");
    const projectId = /^projects\/([^/]+)\//.exec(key)?.[1];
    // Any org that can read the project (owner org or a share) can read its files.
    if (!projectId) throw new HttpError(404, "Not found");
    await projectForSession(projectId, s, "read").catch(() => {
      throw new HttpError(404, "Not found");
    });
    const buf = await get(key).catch(() => {
      throw new HttpError(404, "Not found");
    });
    const name = key.split("/").pop();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentTypeFor(key),
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${name}"`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
