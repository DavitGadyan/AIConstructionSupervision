import { apiError, HttpError, requireApiSession, validate } from "@/lib/server/auth";
import { CompanyPatchSchema, getCompany, patchCompany } from "@/lib/server/profile";

/** The caller's company profile and members. */
export async function GET(req: Request) {
  try {
    const s = await requireApiSession(req);
    return Response.json(await getCompany(s));
  } catch (e) {
    return apiError(e);
  }
}

/** Owner only. Any subset of name, legalName, taxId, address, phone, email, website; "" clears an optional field. */
export async function PATCH(req: Request) {
  try {
    const s = await requireApiSession(req);
    if (s.role !== "owner") throw new HttpError(403, "Only a company owner can edit the company profile");
    const body = await req.json().catch(() => {
      throw new HttpError(400, "Body must be JSON");
    });
    return Response.json(await patchCompany(s, validate(CompanyPatchSchema, body, "Invalid company profile")));
  } catch (e) {
    return apiError(e);
  }
}
