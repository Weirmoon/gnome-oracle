import { captureProvider } from "./store";
import { generateProviderJSON, streamProviderChat } from "./protocol";
import type { ChatOptions, ProviderConnection } from "./types";

export { ProviderError } from "./types";
export type { ChatMessage, ProviderConnection, ProviderProfile } from "./types";

/** Capture once per logical request (including all six Council turns). */
export function captureActiveProvider(): Readonly<ProviderConnection> { return captureProvider(); }

export async function streamChat(options: ChatOptions & { profile?: ProviderConnection }): Promise<Response> {
  const profile = options.profile ?? captureActiveProvider();
  return streamProviderChat(profile, options);
}

export async function generateJSON(prompt: string, options: { signal?: AbortSignal; profile?: ProviderConnection } = {}): Promise<unknown> {
  const profile = options.profile ?? captureActiveProvider();
  return generateProviderJSON(profile, prompt, options);
}
