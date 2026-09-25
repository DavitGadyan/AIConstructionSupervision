/** Contact / demo-request form. Logs server-side; wire to CRM or email in production. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !/^\S+@\S+\.\S+$/.test(String(body.email))) return Response.json({ error: "A valid email is required" }, { status: 400 });
  const topic = body.topic === "inspection" ? "inspection" : "pilot";
  console.info("[contact]", { topic, name: body.name, email: body.email, company: body.company, role: body.role, locale: body.locale, message: String(body.message ?? "").slice(0, 2000) });
  return Response.json({ ok: true });
}
