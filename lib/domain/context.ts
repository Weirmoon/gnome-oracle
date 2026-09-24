export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export function consultationContext(system: string, question: string, rows: {question:string;answer:string;status:string}[], budget = 6000): ChatMessage[] {
  const pairs = rows.filter(r => r.status === "complete" && r.answer.trim()).slice(-6);
  // Conservative character approximation; reserve room for the answer and prompt.
  const available = Math.max(0, budget * 3 - system.length - question.length - 1200);
  let used = 0;
  const kept: typeof pairs = [];
  for (let i = pairs.length - 1; i >= 0; i--) {
    const size = pairs[i].question.length + pairs[i].answer.length;
    if (used + size > available) break;
    kept.unshift(pairs[i]); used += size;
  }
  return [{ role: "system", content: system }, ...kept.flatMap(r => [{ role: "user" as const, content: r.question }, { role: "assistant" as const, content: r.answer }]), { role: "user", content: question }];
}
