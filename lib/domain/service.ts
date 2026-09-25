import { type SqlStore, getCharacter, hydrate, insertCharacter, parse } from "./store";
import { consultationContext, type ChatMessage } from "./context";
import { validateCharacter } from "./characters";
import { buildPrompt } from "./generation";
import type { Character } from "./types";
import { isCritterId, type CritterId } from "../../components/oracle/critters/catalog";
import { CRITTER_PROMPTS, pickFallbackLine } from "../../components/oracle/critters/prompts.server";
import { ReasoningSplitter, stripReasoning } from "../providers/reasoning";
import { SOURCES_HEADER, encodeSources, searchContext, type SearchResult } from "../search/format";

export interface AiService {
  capture(): Promise<unknown>;
  stream(messages: ChatMessage[], opts: { temperature?: number; numPredict?: number; think?: boolean; reasoning?: boolean; grounding?: string; signal?: AbortSignal; profile?: unknown }): Promise<ReadableStream<Uint8Array>>;
  json(prompt: string, signal?: AbortSignal): Promise<unknown>;
  /** Web results for a question when search is switched on; absent where search isn't supported. */
  search?(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
}
export interface Services { store: SqlStore; ai: AiService }
const json = (value: unknown, status = 200) => Response.json(value, { status });
/**
 * Serious mode trades some wackiness for accuracy: a cooler temperature, an
 * accuracy-first instruction, and the answer worked out step by step first.
 * Fun mode (the default) leaves each persona's own temperature alone.
 */
const SERIOUS_TEMPERATURE = 0.35;
const SERIOUS_PROMPT = " Serious mode: accuracy comes first. Double-check facts and numbers, say so if you are unsure, and keep the character voice light.";
const tone = (c: Character, serious: unknown) => serious === true
  ? { temperature: Math.min(c.temperature, SERIOUS_TEMPERATURE), extra: SERIOUS_PROMPT }
  : { temperature: c.temperature, extra: "" };
/** Captured profiles are either a connection (web) or a native snapshot wrapping one. */
const thinks = (captured: unknown) => {
  const value = captured as { thinking?: string; profile?: { thinking?: string } } | null;
  return (value?.thinking ?? value?.profile?.thinking) === "on";
};
const enc = new TextEncoder();
const promptFor = (c: Character, style?: string, mood?: string) => c.system_prompt + " Stay in character. Reply in 2-3 short sentences; do not reveal internal reasoning. " + (style === "oracle-chaos" ? "Be weird, dramatic and surprising but coherent." : style === "mostly-comedy" ? "Mostly comedy, with at most one useful fact." : "Give a useful answer first, with character humor.") + (c.meta.moods.includes(mood ?? "") ? ` Mood: ${mood}.` : "");

async function body(init: RequestInit) {
  if (typeof init.body !== "string" || init.body.length > 12_000_000) throw new Error("Invalid or oversized request.");
  const value = JSON.parse(init.body);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
  return value;
}
async function consultation(s: SqlStore, id: number) {
  const [row] = await s.all<any>("SELECT * FROM consultations WHERE id=?", [id]);
  return row ? { ...row, character_snapshot: parse(row.character_snapshot), messages: await s.all<any>("SELECT * FROM history WHERE consultation_id=? ORDER BY id", [id]) } : null;
}
async function newConsultation(s: SqlStore, title: string, snapshot: unknown, mode = "single") {
  return (await s.run("INSERT INTO consultations(title,mode,character_snapshot) VALUES(?,?,?)", [title.slice(0, 100), mode, JSON.stringify(snapshot)])).lastInsertRowid;
}
async function addExchange(s: SqlStore, cid: number, c: Character, question: string, phase = "answer") {
  return (await s.run("INSERT INTO history(consultation_id,character_id,persona_name,persona_emoji,question,character_snapshot,status,phase) VALUES(?,?,?,?,?,?,'incomplete',?)", [cid, c.id, c.name, c.emoji, question, JSON.stringify(c), phase])).lastInsertRowid;
}
function persistedStream(source: ReadableStream<Uint8Array>, s: SqlStore, id: number, signal?: AbortSignal) {
  const reader = source.getReader(), decoder = new TextDecoder(); let answer = "", finished = false;
  const save = async (status: string, error: string | null = null) => { if (finished) return; finished = true; await s.run("UPDATE history SET answer=?,status=?,error=? WHERE id=?", [answer, status, error, id]); };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (signal?.aborted) { await reader.cancel(); answer = stripReasoning(answer); await save("incomplete"); controller.close(); return; }
        const { value, done } = await reader.read();
        if (done) { answer = stripReasoning(answer + decoder.decode()); await save(signal?.aborted ? "incomplete" : "complete"); controller.close(); }
        else { answer += decoder.decode(value, { stream: true }); controller.enqueue(value); }
      } catch (error) { answer = stripReasoning(answer); await save("incomplete", "Response interrupted. Retry explicitly."); controller.error(error); }
    },
    async cancel(reason) { try { await reader.cancel(reason); } finally { answer = stripReasoning(answer); await save("incomplete"); } },
  });
}

export async function handleApi(path: string, init: RequestInit, { store: s, ai }: Services): Promise<Response> {
  const url = new URL(path, "http://gnome.local"), route = url.pathname, method = init.method ?? "GET";
  try {
    if (route === "/api/characters") {
      if (method === "GET") return json((await s.all("SELECT * FROM characters ORDER BY is_seed DESC,name")).map(hydrate));
      if (method === "POST") { const c = validateCharacter(await body(init)); return json(await s.transaction(() => insertCharacter(s, c)), 201); }
    }
    const characterMatch = route.match(/^\/api\/characters\/(\d+)$/);
    if (characterMatch) {
      const id = Number(characterMatch[1]), existing = await getCharacter(s, id);
      if (!existing) return json({ error: "Persona not found." }, 404);
      if (method === "GET") return json(existing);
      if (existing.is_seed) return json({ error: "Duplicate a built-in persona to edit it." }, 403);
      if (method === "DELETE") { await s.run("DELETE FROM characters WHERE id=?", [id]); return json({ deleted: true }); }
      if (method === "PATCH") {
        const c = validateCharacter(await body(init));
        await s.run("UPDATE characters SET name=?,emoji=?,description=?,system_prompt=?,temperature=?,meta=? WHERE id=?", [c.name, c.emoji, c.description, c.system_prompt, c.temperature, JSON.stringify(c.meta), id]);
        return json(await getCharacter(s, id));
      }
    }
    if (route === "/api/characters/generate" && method === "POST") {
      const b = await body(init); if (typeof b.vibe !== "string" || !b.vibe.trim() || b.vibe.length > 4000) return json({ error: "Describe a vibe in up to 4,000 characters." }, 400);
      const c = validateCharacter(await ai.json(buildPrompt(b.vibe), init.signal ?? undefined));
      return json(await s.transaction(() => insertCharacter(s, c)), 201);
    }
    if (route === "/api/history" && method === "GET") return json(await s.all(`SELECT * FROM history ${url.searchParams.get("favorites") === "1" ? "WHERE favorite=1" : ""} ORDER BY created_at DESC,id DESC LIMIT 500`));
    const historyMatch = route.match(/^\/api\/history\/(\d+)$/);
    if (historyMatch) {
      const id = Number(historyMatch[1]);
      if (method === "PATCH") { await s.run("UPDATE history SET favorite=1-favorite WHERE id=?", [id]); const [row] = await s.all<any>("SELECT favorite FROM history WHERE id=?", [id]); return row ? json(row) : json({ error: "Answer not found." }, 404); }
      if (method === "DELETE") { await s.run("DELETE FROM history WHERE id=?", [id]); return json({ deleted: true }); }
    }
    if (route === "/api/consultations" && method === "GET") return json(await s.all("SELECT id,title,mode,created_at FROM consultations ORDER BY id DESC LIMIT 500"));
    const consultationMatch = route.match(/^\/api\/consultations\/(\d+)$/);
    if (consultationMatch && method === "GET") { const c = await consultation(s, Number(consultationMatch[1])); return c ? json(c) : json({ error: "Consultation not found." }, 404); }
    if (route === "/api/ask" && method === "POST") {
      const b = await body(init), question = typeof b.question === "string" ? b.question.trim() : "";
      if (!question || question.length > 12000) return json({ error: "Ask a question in up to 12,000 characters." }, 400);
      let current = b.consultationId ? await consultation(s, Number(b.consultationId)) : null;
      if (b.consultationId && (!current || current.mode !== "single")) return json({ error: "Consultation not found." }, 404);
      const c = current ? current.character_snapshot as Character : await getCharacter(s, Number(b.characterId));
      if (!c) return json({ error: "Choose a persona." }, 400);
      const profile = await ai.capture();
      const budget = (profile as { contextBudget?: number } | null)?.contextBudget ?? 6000;
      const { temperature, extra } = tone(c, b.serious);
      const found = await ai.search?.(question, init.signal ?? undefined) ?? [];
      const messages = consultationContext(promptFor(c, b.responseStyle, b.mood) + extra, question, current?.messages ?? [], budget);
      const source = await ai.stream(messages, { temperature, think: b.serious === true || thinks(profile), reasoning: true, grounding: searchContext(found), signal: init.signal ?? undefined, profile });
      const cid = current?.id ?? await newConsultation(s, question, c);
      const id = await addExchange(s, cid, c, question);
      return new Response(persistedStream(source, s, id, init.signal ?? undefined), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-History-Id": String(id), "X-Consultation-Id": String(cid), "X-Accel-Buffering": "no", ...(found.length ? { [SOURCES_HEADER]: encodeSources(found) } : {}) } });
    }
    if (route === "/api/quip" && method === "POST") {
      const b = await body(init);
      if (!isCritterId(b.critterId)) return json({ error: "Unknown critter." }, 400);
      const fallback = () => new Response(pickFallbackLine(b.critterId));
      if (b.generated !== true) return fallback();
      const c = await getCharacter(s, Number(b.characterId)); if (!c) return fallback();
      try { return new Response(await ai.stream([{ role: "system", content: promptFor(c, "mostly-comedy", b.mood) + " " + CRITTER_PROMPTS[b.critterId as CritterId].hint + " Exactly one line, at most 15 words." }, { role: "user", content: "React now." }], { temperature: c.temperature, numPredict: 60, think: false, signal: init.signal ?? undefined })); } catch { return fallback(); }
    }
    if (route === "/api/council" && method === "POST") return await council(await body(init), s, ai, init.signal ?? undefined);
    if (route === "/api/backup" && method === "GET") return json(await s.transaction(async () => ({ version: 1, characters: (await s.all("SELECT * FROM characters WHERE is_seed=0")).map(hydrate), consultations: await s.all("SELECT * FROM consultations"), history: await s.all("SELECT * FROM history") })));
    if (route === "/api/backup" && method === "POST") return await restore(await body(init), s);
    return json({ error: "Unknown application service." }, 404);
  } catch (error) {
    if (init.signal?.aborted) return json({ error: "Request cancelled." }, 499);
    return json({ error: error instanceof Error ? error.message : "The request failed." }, 400);
  }
}

async function council(b: any, s: SqlStore, ai: AiService, signal?: AbortSignal) {
  const previous = b.consultationId ? await consultation(s, Number(b.consultationId)) : null;
  let characters: Character[], question: string, cid: number;
  if (previous) {
    if (previous.mode !== "council" || !Number.isInteger(b.retryIndex) || b.retryIndex < 0 || b.retryIndex > 5) return json({ error: "Select a failed Council turn to retry." }, 400);
    characters = previous.character_snapshot; question = previous.title;
    const first = previous.messages[0]; if (first) question = first.question;
    cid = previous.id;
    if (previous.messages.some((m: any) => m.phase === `council-${b.retryIndex}` && m.status === "complete")) return json({ error: "This turn is already complete." }, 409);
  } else {
    if (!Array.isArray(b.characterIds) || b.characterIds.length !== 3) return json({ error: "Choose three distinct Council personas." }, 400);
    const numericIds = b.characterIds.map((id: unknown) => Number(id));
    if (numericIds.some((id: number) => !Number.isInteger(id)) || new Set(numericIds).size !== 3) return json({ error: "Choose three distinct Council personas." }, 400);
    characters = (await Promise.all(numericIds.map((id: number) => getCharacter(s, id)))).filter(Boolean) as Character[];
    question = typeof b.question === "string" ? b.question.trim() : "";
    if (characters.length !== 3 || !question || question.length > 12000) return json({ error: "Choose three personas and enter a question." }, 400);
    cid = await newConsultation(s, question, characters, "council");
  }
  const profile = await ai.capture();
  const local = new AbortController();
  const abort = () => local.abort(); signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) local.abort();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => { if (!local.signal.aborted) controller.enqueue(enc.encode(JSON.stringify(event) + "\n")); };
      try {
        send({ type: "session", consultationId: cid });
        // One search serves all six turns: they share the question.
        const found = await ai.search?.(question, local.signal) ?? [];
        if (found.length) send({ type: "sources", sources: found.map(({ title, url }) => ({ title, url })) });
        const turns = previous ? [b.retryIndex] : [0, 1, 2, 3, 4, 5];
        for (const index of turns) {
          if (local.signal.aborted) break;
          const c = characters[index % 3];
          const initials = await s.all<any>("SELECT persona_name,answer FROM history WHERE consultation_id=? AND phase IN ('council-0','council-1','council-2') AND status='complete' ORDER BY id", [cid]);
          const content = index < 3 ? question : `Original question: ${question}\nCouncil's initial answers:\n${initials.map(x => `${x.persona_name}: ${x.answer}`).join("\n")}\nOffer one short rebuttal or agreement. Do not invent missing answers.`;
          const id = await addExchange(s, cid, c, question, `council-${index}`);
          send({ type: "speaker", index, historyId: id, character: c, phase: index < 3 ? "answer" : "rebuttal" });
          let full = "";
          try {
            const { temperature, extra } = tone(c, b.serious);
            const source = await ai.stream([{ role: "system", content: promptFor(c, b.responseStyle) + extra }, { role: "user", content }], { temperature, think: b.serious === true || thinks(profile), reasoning: true, grounding: searchContext(found), signal: local.signal, profile });
            const reader = source.getReader(), decoder = new TextDecoder(), splitter = new ReasoningSplitter();
            const relay = (chunk: string) => {
              const { answer, reasoning } = splitter.push(chunk);
              if (reasoning) send({ type: "thinking", index, text: reasoning });
              if (answer) { full += answer; send({ type: "text", index, text: answer }); }
            };
            while (!local.signal.aborted) { const { done, value } = await reader.read(); if (done) break; relay(decoder.decode(value, { stream: true })); }
            if (local.signal.aborted) await reader.cancel();
            relay(decoder.decode());
            await s.run("UPDATE history SET answer=?,status=? WHERE id=?", [full, local.signal.aborted ? "incomplete" : "complete", id]);
            send({ type: "done", index, historyId: id });
          } catch (error) {
            const message = local.signal.aborted ? "Cancelled." : error instanceof Error ? error.message : "This speaker could not answer.";
            await s.run("UPDATE history SET answer=?,status='incomplete',error=? WHERE id=?", [full, message, id]);
            send({ type: "error", index, error: message });
          }
        }
      } catch { send({ type: "error", error: "Council interrupted. Saved responses remain in History." }); }
      finally { signal?.removeEventListener("abort", abort); try { controller.close(); } catch { /* cancelled */ } }
    }, cancel() { local.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Consultation-Id": String(cid), "X-Accel-Buffering": "no" } });
}

async function restore(b: any, s: SqlStore) {
  if (b.version !== 1 || !Array.isArray(b.characters) || !Array.isArray(b.consultations) || !Array.isArray(b.history) || b.history.length > 10000) return json({ error: "Invalid backup format." }, 400);
  const characters = b.characters.map(validateCharacter);
  // Validate the entire archive before beginning the transaction.
  for (const c of b.consultations) {
    if (!Number.isInteger(c.id) || typeof c.title !== "string" || !["single", "council"].includes(c.mode)) throw new Error("Invalid consultation in backup.");
    const snapshot = parse(c.character_snapshot);
    if (c.mode === "council") { if (!Array.isArray(snapshot) || snapshot.length !== 3) throw new Error("Invalid Council snapshot."); snapshot.forEach(validateCharacter); }
    else validateCharacter(snapshot);
  }
  for (const h of b.history) if (typeof h.question !== "string" || typeof h.answer !== "string" || !b.consultations.some((c: any) => c.id === h.consultation_id) || !["complete", "incomplete"].includes(h.status)) throw new Error("Invalid history in backup.");
  await s.transaction(async () => {
    const characterIds = new Map<number, number>();
    for (let i = 0; i < characters.length; i++) characterIds.set(b.characters[i].id, (await insertCharacter(s, characters[i])).id);
    const ids = new Map<number, number>();
    for (const c of b.consultations) {
      const snapshot = parse(c.character_snapshot);
      const normalized = (Array.isArray(snapshot) ? snapshot : [snapshot]).map((p: unknown) => {
        const source = p as { id?: number };
        return { ...validateCharacter(p), id: characterIds.get(source.id ?? -1) ?? null };
      });
      const safeSnapshot = Array.isArray(snapshot) ? normalized : normalized[0];
      ids.set(c.id, (await s.run("INSERT INTO consultations(title,mode,character_snapshot,created_at) VALUES(?,?,?,?)", [c.title, c.mode, JSON.stringify(safeSnapshot), c.created_at ?? new Date().toISOString()])).lastInsertRowid);
    }
    for (const h of b.history) {
      let safeHistorySnapshot: unknown = null;
      if (h.character_snapshot) {
        const raw = parse(h.character_snapshot);
        try { safeHistorySnapshot = { ...validateCharacter(raw), id: characterIds.get((raw as { id?: number }).id ?? -1) ?? null }; } catch { safeHistorySnapshot = null; }
      }
      await s.run("INSERT INTO history(consultation_id,character_id,persona_name,persona_emoji,question,answer,favorite,created_at,status,character_snapshot,phase,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", [ids.get(h.consultation_id), characterIds.get(h.character_id) ?? null, String(h.persona_name ?? "Oracle").slice(0, 120), String(h.persona_emoji ?? "✨").slice(0, 12), h.question.slice(0, 12000), h.answer.slice(0, 20000), h.favorite ? 1 : 0, h.created_at ?? new Date().toISOString(), h.status, safeHistorySnapshot ? JSON.stringify(safeHistorySnapshot) : null, String(h.phase ?? "answer").slice(0, 80), typeof h.error === "string" ? h.error.slice(0, 1000) : null]);
    }
  });
  return json({ imported: true });
}
