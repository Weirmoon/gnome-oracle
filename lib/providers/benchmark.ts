/**
 * Results of the model benchmark run for this app (2026-09-24). CPU-only
 * (Ollama num_gpu 0, 4 threads, 4k context) on a desktop CPU, so a small server
 * will be slower across the board; the ranking is what carries over.
 *
 * Tasks used the app's real prompts: a factual Astronomer answer, a Gnome answer
 * (capital of Australia), a critter quip, persona generation (validated JSON),
 * and a short arithmetic puzzle. Correctness was judged by reading each answer.
 */
export type Verdict = "right" | "partly" | "wrong" | "empty" | "leaked";

export interface BenchmarkRow {
  id: string;
  /** Memory while loaded (Ollama /api/ps). */
  ramGb: number;
  tokensPerSecond: number;
  loadSeconds: number;
  /** Full factual answer, including load on first use. */
  answerSeconds: number;
  quipSeconds: number;
  personaJson: boolean;
  personaSeconds: number;
  facts: Verdict;
  maths: Verdict;
  /** Only for models that think natively. */
  thinkingMaths?: Verdict;
  thinkingSeconds?: number;
}

export const BENCHMARK_DATE = "2026-09-24";
export const BENCHMARK_CONDITIONS = "CPU only, 4 threads, 4k context, on a desktop CPU. Expect a small server to be slower; compare models against each other.";

export const BENCHMARK: BenchmarkRow[] = [
  { id: "gemma3:1b", ramGb: 0.88, tokensPerSecond: 46.7, loadSeconds: 2.3, answerSeconds: 4.8, quipSeconds: 0.7, personaJson: true, personaSeconds: 19.6, facts: "wrong", maths: "wrong" },
  { id: "qwen3:0.6b", ramGb: 1.02, tokensPerSecond: 87.3, loadSeconds: 0.8, answerSeconds: 1.8, quipSeconds: 0.4, personaJson: true, personaSeconds: 7.1, facts: "wrong", maths: "wrong", thinkingMaths: "right", thinkingSeconds: 2.2 },
  { id: "gemma2:2b", ramGb: 1.93, tokensPerSecond: 25.5, loadSeconds: 1.5, answerSeconds: 4.1, quipSeconds: 1.6, personaJson: false, personaSeconds: 29.5, facts: "wrong", maths: "wrong" },
  { id: "qwen3:1.7b", ramGb: 1.88, tokensPerSecond: 35.4, loadSeconds: 1.3, answerSeconds: 3.4, quipSeconds: 0.6, personaJson: true, personaSeconds: 35, facts: "right", maths: "right", thinkingMaths: "right", thinkingSeconds: 7.2 },
  { id: "deepseek-r1:1.5b", ramGb: 1.3, tokensPerSecond: 41, loadSeconds: 1, answerSeconds: 6.2, quipSeconds: 1.6, personaJson: true, personaSeconds: 27.3, facts: "empty", maths: "right", thinkingMaths: "right", thinkingSeconds: 7.6 },
  { id: "llama3.2:3b", ramGb: 2.56, tokensPerSecond: 21.1, loadSeconds: 3.1, answerSeconds: 6.7, quipSeconds: 1.6, personaJson: true, personaSeconds: 55.1, facts: "right", maths: "wrong" },
  { id: "qwen3:4b", ramGb: 3.18, tokensPerSecond: 15.5, loadSeconds: 2, answerSeconds: 15.9, quipSeconds: 5.2, personaJson: true, personaSeconds: 74.6, facts: "leaked", maths: "leaked", thinkingMaths: "empty", thinkingSeconds: 91.1 },
  { id: "phi4-mini", ramGb: 3.09, tokensPerSecond: 17.6, loadSeconds: 1.8, answerSeconds: 5.2, quipSeconds: 1.6, personaJson: true, personaSeconds: 61.2, facts: "right", maths: "wrong" },
  { id: "gemma3:4b", ramGb: 2.88, tokensPerSecond: 16.2, loadSeconds: 2.8, answerSeconds: 9.5, quipSeconds: 3.5, personaJson: true, personaSeconds: 70.9, facts: "right", maths: "right" },
  { id: "gemma3n:e2b", ramGb: 6.19, tokensPerSecond: 22.7, loadSeconds: 2.6, answerSeconds: 6.9, quipSeconds: 3.3, personaJson: false, personaSeconds: 52.2, facts: "partly", maths: "wrong" },
  { id: "gemma4:e2b", ramGb: 6.73, tokensPerSecond: 27.7, loadSeconds: 4.8, answerSeconds: 7.2, quipSeconds: 1.4, personaJson: true, personaSeconds: 44.7, facts: "partly", maths: "wrong", thinkingMaths: "right", thinkingSeconds: 8.7 },
  { id: "gemma3n:e4b", ramGb: 8.17, tokensPerSecond: 13.7, loadSeconds: 3.6, answerSeconds: 11.5, quipSeconds: 3.6, personaJson: true, personaSeconds: 85.3, facts: "right", maths: "wrong" },
  { id: "gemma4:e4b", ramGb: 9.43, tokensPerSecond: 13.7, loadSeconds: 6.1, answerSeconds: 12, quipSeconds: 2.9, personaJson: true, personaSeconds: 87.8, facts: "right", maths: "wrong", thinkingMaths: "right", thinkingSeconds: 7.3 },
  { id: "qwen3:4b-instruct", ramGb: 3.18, tokensPerSecond: 16.8, loadSeconds: 1.8, answerSeconds: 8.1, quipSeconds: 2, personaJson: true, personaSeconds: 77.2, facts: "right", maths: "right" },
];
