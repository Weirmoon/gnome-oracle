import { pullModel } from "@/lib/providers/protocol";
import { modelRouteTarget } from "@/lib/providers/route-profile";
import { providerFailure, readProviderBody, requireProviderAdmin } from "@/lib/providers/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams Ollama download progress as NDJSON; cancelling the request stops the pull. */
export async function POST(request: Request) {
  try {
    requireProviderAdmin(request);
    const { profile, model } = modelRouteTarget(await readProviderBody(request));
    const progress = await pullModel(profile, model, request.signal);
    return new Response(progress, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch (error) { return providerFailure(error); }
}
