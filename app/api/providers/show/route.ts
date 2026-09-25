import { getModelInfo } from "@/lib/providers/protocol";
import { modelRouteTarget } from "@/lib/providers/route-profile";
import { providerFailure, providerJson, readProviderBody, requireProviderAdmin } from "@/lib/providers/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireProviderAdmin(request);
    const { profile, model } = modelRouteTarget(await readProviderBody(request));
    const info = await getModelInfo(profile, model, AbortSignal.any([request.signal, AbortSignal.timeout(20000)]));
    return providerJson({ info });
  } catch (error) { return providerFailure(error); }
}
