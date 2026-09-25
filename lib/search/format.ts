/** Shared between server, native and browser code: no Node imports here. */
export interface SearchResult { title: string; url: string; snippet: string }
export interface SearchSource { title: string; url: string }

export const SOURCES_HEADER = "X-Sources";

/** Appended to the persona prompt so the answer is grounded in what was found. */
export function searchContext(results: SearchResult[], today = new Date()): string {
  if (!results.length) return "";
  const lines = results.map((result, index) => `[${index + 1}] ${result.title}: ${result.snippet}`);
  // Small models don't know the date, so they can't tell a search result is newer than their memory.
  return `\n\nToday is ${today.toISOString().slice(0, 10)}. Web search results for this question follow. They are newer than your training: ` +
    "when they mention more recent events or figures than you remember, trust the results over your memory. " +
    "Say so if they don't answer the question. Don't list links; the app shows sources.\n" + lines.join("\n");
}

export function encodeSources(results: SearchResult[]): string {
  return encodeURIComponent(JSON.stringify(results.map(({ title, url }) => ({ title, url }))));
}

export function decodeSources(header: string | null): SearchSource[] {
  if (!header) return [];
  try {
    const value: unknown = JSON.parse(decodeURIComponent(header));
    if (!Array.isArray(value)) return [];
    return value.filter((s): s is SearchSource => !!s && typeof s.title === "string" && typeof s.url === "string" && /^https?:\/\//.test(s.url)).slice(0, 8);
  } catch { return []; }
}
