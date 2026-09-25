import { searchStatus, setSearchEnabled } from "@/lib/search/searxng";
import { providerFailure, providerJson, readProviderBody, requireProviderAdmin } from "@/lib/providers/http";
import { ProviderError } from "@/lib/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anyone may see whether search is on; only an administrator may switch it. */
export async function GET() {
  try { return providerJson(await searchStatus()); }
  catch (error) { return providerFailure(error); }
}

export async function POST(request: Request) {
  try {
    requireProviderAdmin(request);
    const body = await readProviderBody(request);
    if (typeof body.enabled !== "boolean") throw new ProviderError("Choose whether web search is on or off.", 400);
    return providerJson(await setSearchEnabled(body.enabled));
  } catch (error) {
    if (error instanceof Error && !(error instanceof ProviderError) && error.name !== "AbortError") return providerJson({ error: error.message }, 503);
    return providerFailure(error);
  }
}
