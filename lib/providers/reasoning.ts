/**
 * Reasoning ("thinking") travels in-band inside the plain-text answer stream,
 * framed by control characters that never appear in model prose. Consumers
 * that don't care call stripReasoning(); the UI splits it with ReasoningSplitter.
 */
export const REASONING_START = "\u0002";
export const REASONING_END = "\u0003";

const FRAMED = new RegExp(`${REASONING_START}[^${REASONING_END}]*(?:${REASONING_END}|$)`, "g");

export function stripReasoning(text: string): string {
  return text.replace(FRAMED, "");
}

/** Incrementally separates framed reasoning from answer text across chunk boundaries. */
export class ReasoningSplitter {
  private inside = false;
  push(chunk: string): { answer: string; reasoning: string } {
    let answer = "", reasoning = "";
    for (const char of chunk) {
      if (char === REASONING_START) this.inside = true;
      else if (char === REASONING_END) this.inside = false;
      else if (this.inside) reasoning += char;
      else answer += char;
    }
    return { answer, reasoning };
  }
}

/**
 * Some OpenAI-compatible servers (LM Studio, vLLM, llama.cpp) inline reasoning
 * as <think>…</think> in the content. This rewrites it into framed reasoning,
 * holding back partial tags that straddle chunks.
 */
export class ThinkTagParser {
  private inside = false;
  private held = "";
  push(text: string): { answer: string; reasoning: string } {
    let buffer = this.held + text, answer = "", reasoning = "";
    this.held = "";
    for (;;) {
      const tag = this.inside ? "</think>" : "<think>";
      const at = buffer.indexOf(tag);
      if (at >= 0) {
        if (this.inside) reasoning += buffer.slice(0, at); else answer += buffer.slice(0, at);
        buffer = buffer.slice(at + tag.length);
        this.inside = !this.inside;
        continue;
      }
      // Hold back a suffix that could be the start of the tag.
      let keep = 0;
      for (let n = Math.min(tag.length - 1, buffer.length); n > 0; n--) if (tag.startsWith(buffer.slice(-n))) { keep = n; break; }
      const emit = buffer.slice(0, buffer.length - keep);
      if (this.inside) reasoning += emit; else answer += emit;
      this.held = buffer.slice(buffer.length - keep);
      return { answer, reasoning };
    }
  }
  flush(): { answer: string; reasoning: string } {
    const rest = this.held; this.held = "";
    return this.inside ? { answer: "", reasoning: rest } : { answer: rest, reasoning: "" };
  }
}
