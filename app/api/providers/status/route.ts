import { listProfiles } from "@/lib/providers/store";
import { managementEnabled, providerFailure, providerJson } from "@/lib/providers/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { profiles, activeProfileId } = listProfiles();
    const active = profiles.find(value => value.id === activeProfileId)!;
    return providerJson({ configured: true, managementEnabled: managementEnabled(), activeProfile: { id: active.id, name: active.name, kind: active.kind, model: active.model } });
  } catch (error) { return providerFailure(error); }
}
