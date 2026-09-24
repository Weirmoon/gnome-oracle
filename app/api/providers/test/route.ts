import { captureProvider, previewConnection } from "@/lib/providers/store";
import { testProviderConnection } from "@/lib/providers/protocol";
import { providerFailure, providerJson, readProviderBody, requireProviderAdmin } from "@/lib/providers/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireProviderAdmin(request);
    const body = await readProviderBody(request);
    const profile = body.profile ? previewConnection(body.profile) : captureProvider(typeof body.profileId === "string" ? body.profileId : undefined);
    await testProviderConnection(profile, AbortSignal.any([request.signal, AbortSignal.timeout(120000)]));
    return providerJson({ ok: true });
  } catch (error) { return providerFailure(error); }
}
