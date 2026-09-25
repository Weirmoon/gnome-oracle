import { activateProfile, captureProvider, deleteProfile, listProfiles, saveProfile } from "@/lib/providers/store";
import { switchActiveModel } from "@/lib/providers/protocol";
import type { ProviderConnection } from "@/lib/providers/types";
import { providerFailure, providerJson, readProviderBody, requireProviderAdmin } from "@/lib/providers/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function activeConnection(): ProviderConnection | null {
  try { return captureProvider(); } catch { return null; }
}

/** Unload whatever the old active model was when the active model changes. */
async function afterActiveChange(before: ProviderConnection | null) {
  const after = activeConnection();
  return after ? switchActiveModel(before, after) : { unloaded: [] };
}

export async function GET(request: Request) {
  try { requireProviderAdmin(request); return providerJson(listProfiles()); }
  catch (error) { return providerFailure(error); }
}

export async function POST(request: Request) {
  try {
    requireProviderAdmin(request);
    const body = await readProviderBody(request);
    const before = activeConnection();
    const profile = saveProfile(body.profile);
    const modelSwitch = profile.id === listProfiles().activeProfileId ? await afterActiveChange(before) : undefined;
    return providerJson({ profile, modelSwitch }, 201);
  } catch (error) { return providerFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    requireProviderAdmin(request);
    const body = await readProviderBody(request);
    const before = activeConnection();
    activateProfile(body.activeProfileId);
    return providerJson({ ...listProfiles(), modelSwitch: await afterActiveChange(before) });
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
