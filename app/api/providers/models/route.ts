import { captureProvider, previewConnection } from "@/lib/providers/store";
import { listProviderModels } from "@/lib/providers/protocol";
import { providerFailure, providerJson, readProviderBody, requireProviderAdmin } from "@/lib/providers/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireProviderAdmin(request);
    const body = await readProviderBody(request);
    // Listing precedes model selection, so a placeholder satisfies profile validation.
    const draft = body.profile && typeof body.profile === "object" ? { ...body.profile, model: (body.profile as Record<string, unknown>).model || "model-list" } : undefined;
    const profile = draft ? previewConnection(draft) : captureProvider(typeof body.profileId === "string" ? body.profileId : undefined);
    const models = await listProviderModels(profile, AbortSignal.any([request.signal, AbortSignal.timeout(20000)]));
    return providerJson({ models });
  } catch (error) { return providerFailure(error); }
}
