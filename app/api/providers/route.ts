import { activateProfile, deleteProfile, listProfiles, saveProfile } from "@/lib/providers/store";
import { providerFailure, providerJson, readProviderBody, requireProviderAdmin } from "@/lib/providers/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { requireProviderAdmin(request); return providerJson(listProfiles()); }
  catch (error) { return providerFailure(error); }
}

export async function POST(request: Request) {
  try {
    requireProviderAdmin(request);
    const body = await readProviderBody(request);
    return providerJson({ profile: saveProfile(body.profile) }, 201);
  } catch (error) { return providerFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    requireProviderAdmin(request);
    const body = await readProviderBody(request);
    activateProfile(body.activeProfileId);
    return providerJson(listProfiles());
  } catch (error) { return providerFailure(error); }
}

export async function DELETE(request: Request) {
  try {
    requireProviderAdmin(request);
    const body = await readProviderBody(request);
    deleteProfile(body.id);
    return providerJson(listProfiles());
  } catch (error) { return providerFailure(error); }
}
