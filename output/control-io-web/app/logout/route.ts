import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/server/auth";

export async function POST(req: Request) {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.redirect(new URL("/login", req.url), 303);
}
