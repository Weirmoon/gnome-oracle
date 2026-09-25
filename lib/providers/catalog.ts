/**
 * Curated Ollama models that run on small CPU-only servers. These are UI hints
 * only; whether a model can think is confirmed live via Ollama's /api/show.
 */
export interface CatalogModel {
  id: string;
  label: string;
  /** Download size at Ollama's default quantization. */
  sizeGb: number;
  /** Rough total server RAM needed to run it alongside the app at a 4k context. */
  minRamGb: number;
  speed: "fastest" | "fast" | "moderate";
  thinking: boolean;
  note: string;
  bestAt: string;
  weakAt: string;
  useWhen: string;
}

export const DEFAULT_OLLAMA_MODEL = "qwen3:4b-instruct";

export const MODEL_CATALOG: CatalogModel[] = [
  { id: "qwen3:4b-instruct", label: "Qwen3 4B Instruct", sizeGb: 2.5, minRamGb: 4, speed: "moderate", thinking: false, note: "Default. Best persona voice and snappiest quips for 6 GB.", bestAt: "Persona voice, punchy quips, facts and maths", weakAt: "Slower than the 1–2B models; long persona generation", useWhen: "The default for a 6 GB server" },
  { id: "gemma3:4b", label: "Gemma 3 4B", sizeGb: 3.3, minRamGb: 5, speed: "moderate", thinking: false, note: "Just as good an all-rounder: accurate, strong persona voice.", bestAt: "Accurate facts and maths, rich persona voice", weakAt: "Wordier quips; slowest of the 4B models to answer", useWhen: "You prefer Gemma's style, or Qwen slips up" },
  { id: "gemma3:1b", label: "Gemma 3 1B", sizeGb: 0.8, minRamGb: 2, speed: "fastest", thinking: false, note: "Fastest, but gets facts wrong. Fine for quips only.", bestAt: "Speed and tiny memory use", weakAt: "Facts and maths (confidently wrong)", useWhen: "Critter quips only, on very little RAM" },
  { id: "gemma2:2b", label: "Gemma 2 2B", sizeGb: 1.6, minRamGb: 3, speed: "fast", thinking: false, note: "Older. Often fails persona generation; not recommended.", bestAt: "Casual chatter", weakAt: "Persona generation, facts, maths", useWhen: "Not recommended; kept for older setups" },
  { id: "llama3.2:3b", label: "Llama 3.2 3B", sizeGb: 2.0, minRamGb: 4, speed: "fast", thinking: false, note: "Steady voice, but weak at facts and maths.", bestAt: "Steady, readable persona voice", weakAt: "Maths", useWhen: "You want a predictable voice and rarely ask sums" },
  { id: "phi4-mini", label: "Phi-4 mini 3.8B", sizeGb: 2.5, minRamGb: 4, speed: "moderate", thinking: false, note: "Great short quips; weak at maths.", bestAt: "Short, funny one-liners; valid JSON", weakAt: "Maths", useWhen: "Quip-heavy use where accuracy matters less" },
  { id: "qwen3:1.7b", label: "Qwen3 1.7B", sizeGb: 1.4, minRamGb: 3, speed: "fast", thinking: true, note: "Best small pick (~2 GB): accurate, thinks natively. Rarely slips into Chinese.", bestAt: "Accuracy for its size; native thinking", weakAt: "Occasionally drifts into Chinese in quips", useWhen: "RAM is tight (3 GB) but you still want right answers" },
  { id: "qwen3:0.6b", label: "Qwen3 0.6B", sizeGb: 0.5, minRamGb: 2, speed: "fastest", thinking: true, note: "Tiny and very fast; weak facts. Good for testing.", bestAt: "Raw speed, trying thinking cheaply", weakAt: "Facts and maths without thinking", useWhen: "Testing, or extremely low RAM" },
  { id: "gemma3n:e2b", label: "Gemma 3n E2B", sizeGb: 5.6, minRamGb: 8, speed: "moderate", thinking: false, note: "Needs ~8 GB. Leaves stray symbols in replies; not recommended.", bestAt: "Natural persona voice", weakAt: "Stray symbols in replies; persona generation", useWhen: "Not recommended" },
  { id: "gemma3n:e4b", label: "Gemma 3n E4B", sizeGb: 7.5, minRamGb: 10, speed: "moderate", thinking: false, note: "Needs ~10 GB. Leaves stray symbols in replies; prefer Gemma 4.", bestAt: "Accurate facts", weakAt: "Stray symbols in replies; slow", useWhen: "Not recommended; prefer Gemma 4 E4B" },
  { id: "gemma4:e2b", label: "Gemma 4 E2B", sizeGb: 7.2, minRamGb: 8, speed: "moderate", thinking: true, note: "Needs ~8 GB. Quick and thinks, but slipped on facts in testing.", bestAt: "Fast for its size; native thinking fixes maths", weakAt: "Facts slip without thinking", useWhen: "8 GB RAM, with thinking on" },
  { id: "gemma4:e4b", label: "Gemma 4 E4B", sizeGb: 9.6, minRamGb: 10, speed: "moderate", thinking: true, note: "Needs ~10 GB. Best quality tested; thinks natively.", bestAt: "Best overall quality; native thinking", weakAt: "Needs lots of RAM; slow to load", useWhen: "You upgrade to 10 GB+ RAM" },
];

/** Model ids are sent to Ollama's pull/show endpoints, so keep them to registry characters. */
export const MODEL_ID_PATTERN = /^[\w.\-:/]{1,200}$/;
