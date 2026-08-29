import { NextRequest } from "next/server";
import { getCharacter } from "@/lib/db";
import { streamChat, ndjsonToTextStream, type ChatMessage } from "@/lib/ollama";
import { isCritterId } from "@/components/oracle/critters/catalog";
import { CRITTER_PROMPTS, pickFallbackLine } from "@/components/oracle/critters/prompts.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOOD_PROMPTS: Record<string, string> = {
  default: "",
  excited: " Mood: excited and high-energy.",
  grumpy: " Mood: grumpy, cranky, and reluctant.",
  wise: " Mood: wise, patient, and oddly profound.",
  dramatic: " Mood: dramatic and theatrical.",
  sleepy: " Mood: sleepy and distracted.",
  mystical: " Mood: mystical and cryptic.",
  cozy: " Mood: cozy and gentle.",
};

const QUIP_GUARD =
  " Stay fully in character. No asterisk stage directions. Exactly one short line, " +
  "at most 15 words. Do not greet the user and do not answer any question.";

function textResponse(text: string): Response {
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Near-clone of `/api/ask` for ambient critter quips.
 *
 * Deliberately different in three ways: it writes NO history row, returns no
 * `X-History-Id`, and falls back to a canned line instead of an error string
 * when Ollama is down — a critter event is cosmetic and should still play.
 */
export async function POST(req: NextRequest) {
  let body: { characterId?: number; critterId?: string; mood?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (!isCritterId(body.critterId)) {
    return new Response("unknown critter", { status: 400 });
  }
  const critterId = body.critterId;
  const prompt = CRITTER_PROMPTS[critterId];

  const characterId = Number(body.characterId);
  const persona = Number.isFinite(characterId) ? getCharacter(characterId) : undefined;
  if (!persona) return textResponse(pickFallbackLine(critterId));

  const mood = typeof body.mood === "string" ? body.mood.trim().toLowerCase() : "default";
  const moodPrompt = persona.meta.moods.includes(mood) ? MOOD_PROMPTS[mood] ?? "" : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: persona.system_prompt + moodPrompt + " " + prompt.hint + QUIP_GUARD,
    },
    { role: "user", content: "React now." },
  ];

  let ollama: Response;
  try {
    ollama = await streamChat({
      messages,
      temperature: Math.min(1.4, persona.temperature + 0.1),
      numPredict: 60,
    });
  } catch {
    return textResponse(pickFallbackLine(critterId));
  }

  return new Response(ndjsonToTextStream(ollama.body!), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
