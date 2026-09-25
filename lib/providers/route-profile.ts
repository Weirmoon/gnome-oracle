import { captureProvider, previewConnection } from "./store";
import { MODEL_ID_PATTERN } from "./catalog";
import { ProviderError, type ProviderConnection } from "./types";

/** Resolve the connection and target model for per-model routes (show, pull). */
export function modelRouteTarget(body: Record<string, unknown>): { profile: ProviderConnection; model: string } {
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!MODEL_ID_PATTERN.test(model)) throw new ProviderError("Enter a valid model identifier.", 400);
  // The draft may not have a model chosen yet, so the target model satisfies validation.
  const draft = body.profile && typeof body.profile === "object" ? { ...body.profile, model: (body.profile as Record<string, unknown>).model || model } : undefined;
  const profile = draft ? previewConnection(draft) : captureProvider(typeof body.profileId === "string" ? body.profileId : undefined);
  return { profile, model };
}
