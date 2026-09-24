import { timingSafeEqual } from "node:crypto";
import { ProviderError } from "./types";

export function managementEnabled(): boolean { return (process.env.GNOME_ADMIN_TOKEN?.length ?? 0) >= 32; }

export function requireProviderAdmin(request: Request): void {
  const expected = process.env.GNOME_ADMIN_TOKEN;
  if (!expected || expected.length < 32) throw new ProviderError("Connection settings are locked. Set GNOME_ADMIN_TOKEN to a secret of at least 32 characters on the server.", 503);
  const authorization = request.headers.get("Authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    throw new ProviderError("Enter the administrator token to manage AI connections.", 401);
  }
  // Non-cookie bearer authentication cannot be forged by cross-origin forms.
  const origin = request.headers.get("Origin");
  if (origin) {
    const expectedHost = request.headers.get("X-Forwarded-Host") || new URL(request.url).host;
    if (new URL(origin).host !== expectedHost) throw new ProviderError("Connection settings must be changed from this application.", 403);
  }
}

export async function readProviderBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.text();
  if (body.length > 24000) throw new ProviderError("Connection request is too large.", 413);
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new ProviderError("Enter valid connection settings.", 400); }
}

export function providerJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function providerFailure(error: unknown): Response {
  if (error instanceof ProviderError) return providerJson({ error: error.message }, error.status);
  if (error instanceof Error && error.name === "AbortError") return providerJson({ error: "The request was cancelled." }, 499);
  return providerJson({ error: "The connection request failed. Check the server configuration." }, 500);
}
