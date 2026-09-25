"use client";
import { apiFetch } from "@/lib/platform/client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OracleAvatar } from "@/components/oracle";
import type { CritterApi } from "@/components/oracle/critters/useCritterEvents";
import type { PersonaMeta, AvatarVariant } from "@/lib/persona";
import { AVATAR_VARIANTS } from "@/lib/persona";
import { tts } from "@/lib/tts";
import { sound } from "@/lib/sound";
import { BackgroundSettings } from "@/components/background";
import ProviderSettings from "@/components/settings/ProviderSettings";
import BackupSettings from "@/components/settings/BackupSettings";
import { exportProphecyCard } from "@/lib/cards";
import { emitBackgroundPulse } from "@/lib/background";
import Pondering from "@/components/oracle/Pondering";
import Sources from "@/components/oracle/Sources";
import { SOURCES_HEADER, decodeSources, type SearchSource } from "@/lib/search/format";
import { ReasoningSplitter } from "@/lib/providers/reasoning";

// Loaded only when the settings panel opens, so the critter catalog stays out
// of the initial "/" bundle.
const SummonRow = dynamic(() => import("@/components/oracle/critters/SummonRow"), { ssr: false });

interface Character {
  id: number;
  name: string;
  emoji: string;
  description: string;
  meta: PersonaMeta;
}

type ResponseStyle = "funny-useful" | "mostly-comedy" | "oracle-chaos";

type AvatarPref = "auto" | "3d" | "2d" | "sprite";
type AvatarQualityPref = "high" | "low";

const AVATAR_PREFS: { value: AvatarPref; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "3d", label: "3D" },
  { value: "2d", label: "2D" },
  { value: "sprite", label: "Sprite" },
];

const AVATAR_PREF_VALUES: AvatarPref[] = ["auto", "3d", "2d", "sprite"];

const AVATAR_QUALITIES: { value: AvatarQualityPref; label: string }[] = [
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

interface Volumes {
  voice: number;
  music: number;
  sfx: number;
  typing: number;
}

const DEFAULT_VOLUMES: Volumes = { voice: 1, music: 0.5, sfx: 0.6, typing: 0.4 };

const RESPONSE_STYLES: { value: ResponseStyle; label: string }[] = [
  { value: "funny-useful", label: "Funny but useful" },
  { value: "mostly-comedy", label: "Mostly comedy" },
  { value: "oracle-chaos", label: "Oracle chaos" },
];

function readNum(key: string, def: number): number {
  if (typeof localStorage === "undefined") return def;
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) && localStorage.getItem(key) !== null ? v : def;
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [burst, setBurst] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [volumes, setVolumes] = useState<Volumes>(DEFAULT_VOLUMES);
  const [showSettings, setShowSettings] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [consultationId, setConsultationId] = useState<number | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [outfitIndex, setOutfitIndex] = useState(0);
  /** "" = use whatever the persona specifies; otherwise force this body. */
  const [variantOverride, setVariantOverride] = useState<"" | AvatarVariant>("");
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>("funny-useful");
  const [serious, setSerious] = useState(false);
  const [mood, setMood] = useState("default");
  const [streamDone, setStreamDone] = useState(0);
  const [avatarPref, setAvatarPref] = useState<AvatarPref>("auto");
  const [avatarQuality, setAvatarQuality] = useState<AvatarQualityPref>("high");
  const [crittersOn, setCrittersOn] = useState(false);
  const [generatedQuipsOn, setGeneratedQuipsOn] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [fortune, setFortune] = useState("");
  const critterApi = useRef<CritterApi | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selected = characters.find((c) => c.id === selectedId);
  const speaking = streaming || ttsSpeaking;
  const outfits = selected?.meta.appearanceVariants?.length
    ? selected.meta.appearanceVariants
    : selected
      ? [selected.meta.appearance]
      : [];
  const baseAppearance = outfits[outfitIndex] ?? selected?.meta.appearance;
  const selectedAppearance = baseAppearance
    ? { ...baseAppearance, variant: variantOverride || baseAppearance.variant || "gnome" }
    : baseAppearance;
  const moods = selected?.meta.moods?.length ? selected.meta.moods : ["default"];
  const avatarQualityProp =
    avatarPref === "auto"
      ? "auto"
      : avatarPref === "2d"
        ? "2d"
        : avatarPref === "sprite"
          ? "sprite"
          : avatarQuality;

  // Load personas, music playlist, and persisted prefs; subscribe to TTS state.
  useEffect(() => {
    apiFetch("/api/characters")
      .then((r) => r.json())
      .then((data: Character[]) => {
        setCharacters(data);
        if (data.length) setSelectedId(data[0].id);
      })
      .catch(() => {});

    apiFetch("/api/music")
      .then((r) => r.json())
      .then((tracks: string[]) => sound.setPlaylist(tracks))
      .catch(() => {});

    const voice = localStorage.getItem("gnome.voiceOn");
    const music = localStorage.getItem("gnome.musicOn");
    const storedStyle = localStorage.getItem("gnome.responseStyle");
    const storedMood = localStorage.getItem("gnome.mood");
    const storedOutfit = Number(localStorage.getItem("gnome.outfitIndex"));
    const storedAvatar = localStorage.getItem("gnome.avatar");
    const storedAvatarQuality = localStorage.getItem("gnome.avatarQuality");
    const storedCritters = localStorage.getItem("gnome.critters");
    const storedGeneratedQuips = localStorage.getItem("gnome.generatedQuips");
    const voiceOnPref = voice === null ? true : voice === "1";
    const musicOnPref = music === null ? true : music === "1";
    const vols: Volumes = {
      voice: readNum("gnome.vol.voice", DEFAULT_VOLUMES.voice),
      music: readNum("gnome.vol.music", DEFAULT_VOLUMES.music),
      sfx: readNum("gnome.vol.sfx", DEFAULT_VOLUMES.sfx),
      typing: readNum("gnome.vol.typing", DEFAULT_VOLUMES.typing),
    };

    setVoiceOn(voiceOnPref);
    setMusicOn(musicOnPref);
    setVolumes(vols);
    if (isResponseStyle(storedStyle)) setResponseStyle(storedStyle);
    setSerious(localStorage.getItem("gnome.serious") === "1");
    if (storedMood) setMood(storedMood);
    if (Number.isFinite(storedOutfit)) setOutfitIndex(Math.max(0, Math.min(3, storedOutfit)));
    const storedVariant = localStorage.getItem("gnome.variant");
    if (storedVariant && (AVATAR_VARIANTS as string[]).includes(storedVariant)) {
      setVariantOverride(storedVariant as AvatarVariant);
    }
    if ((AVATAR_PREF_VALUES as string[]).includes(storedAvatar ?? "")) {
      setAvatarPref(storedAvatar as AvatarPref);
    }
    if (storedAvatarQuality === "high" || storedAvatarQuality === "low") {
      setAvatarQuality(storedAvatarQuality);
    }
    // Ambient critters default on, but never under reduced motion.
    const reduce =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduce);
    setCrittersOn(reduce ? false : storedCritters === null ? true : storedCritters === "1");
    setGeneratedQuipsOn(storedGeneratedQuips === "1");

    tts.setMuted(!voiceOnPref);
    tts.setVolume(vols.voice);
    sound.setMusicVolume(vols.music);
    sound.setSfxVolume(vols.sfx);
    sound.setTypingVolume(vols.typing);
    sound.setMusicEnabled(musicOnPref);
    // Browsers block audio until first interaction — start on any gesture.
    sound.primeOnFirstGesture();

    const unsub = tts.onSpeakingChange(setTtsSpeaking);
    return () => {
      unsub();
      tts.cancel();
    };
  }, []);

  // Keep TTS voice + SFX theme in sync with the selected persona.
  useEffect(() => {
    if (selected) {
      tts.setVoice(selected.meta.voice);
      sound.setTheme(selected.meta.sfx);
      setOutfitIndex((i) => Math.min(i, (selected.meta.appearanceVariants?.length ?? 1) - 1));
      setMood((current) => (selected.meta.moods.includes(current) ? current : "default"));
    }
  }, [selected]);

  function onPersonaChange(id: number) {
    setSelectedId(id);
    setConsultationId(null);
    setAnswer("");
    setReasoning("");
    setSources([]);
    setHistoryId(null);
    sound.resume();
    const next = characters.find((c) => c.id === id);
    if (next) sound.setTheme(next.meta.sfx);
    sound.switchBell();
  }

  function changeOutfit(index: number) {
    setOutfitIndex(index);
    localStorage.setItem("gnome.outfitIndex", String(index));
    setBurst((b) => b + 1);
    sound.switchBell();
  }

  function shuffleOutfit() {
    if (!outfits.length) return;
    const next =
      outfits.length === 1
        ? 0
        : (outfitIndex + 1 + Math.floor(Math.random() * (outfits.length - 1))) %
          outfits.length;
    changeOutfit(next);
  }

  function changeVariant(value: string) {
    const v = ((AVATAR_VARIANTS as string[]).includes(value) ? value : "") as "" | AvatarVariant;
    setVariantOverride(v);
    localStorage.setItem("gnome.variant", v);
    setBurst((b) => b + 1);
    sound.switchBell();
  }

  function changeResponseStyle(value: ResponseStyle) {
    setResponseStyle(value);
    localStorage.setItem("gnome.responseStyle", value);
  }

  function toggleSerious(value: boolean) {
    setSerious(value);
    localStorage.setItem("gnome.serious", value ? "1" : "0");
  }

  function changeMood(value: string) {
    setMood(value);
    localStorage.setItem("gnome.mood", value);
  }

  function toggleCritters() {
    const next = !crittersOn;
    setCrittersOn(next);
    localStorage.setItem("gnome.critters", next ? "1" : "0");
  }

  function changeAvatarPref(value: AvatarPref) {
    setAvatarPref(value);
    localStorage.setItem("gnome.avatar", value);
  }

  function changeAvatarQuality(value: AvatarQualityPref) {
    setAvatarQuality(value);
    localStorage.setItem("gnome.avatarQuality", value);
  }

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    localStorage.setItem("gnome.voiceOn", next ? "1" : "0");
    tts.setMuted(!next);
  }

  function toggleMusic() {
    const next = !musicOn;
    setMusicOn(next);
    localStorage.setItem("gnome.musicOn", next ? "1" : "0");
    sound.setMusicEnabled(next); // resumes / starts playback (user gesture)
  }

  function changeVolume(key: keyof Volumes, value: number) {
    setVolumes((prev) => ({ ...prev, [key]: value }));
    localStorage.setItem(`gnome.vol.${key}`, String(value));
    if (key === "voice") tts.setVolume(value);
    if (key === "music") sound.setMusicVolume(value);
    if (key === "sfx") sound.setSfxVolume(value);
    if (key === "typing") sound.setTypingVolume(value);
  }

  const ask = useCallback(async () => {
    if (!question.trim() || selectedId == null || streaming) return;

    // "/fairy" (etc.) as the whole input summons a critter instead of asking.
    // Intercepted here so it never reaches /api/ask or the history. summon()
    // validates the id, which avoids importing the catalog on this page.
    const slash = /^\/([a-z]+)\s*$/i.exec(question.trim());
    if (slash && critterApi.current?.summon(slash[1].toLowerCase())) {
      setQuestion("");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    sound.resume();
    sound.tryStartMusic(); // ensure music is rolling if it hasn't started yet
    sound.whoosh();
    tts.begin();
    setAnswer("");
    setReasoning("");
    setSources([]);
    setFavorited(false);
    setHistoryId(null);
    setStreaming(true);
    let firstChunk = true;

    try {
      const res = await apiFetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, characterId: selectedId, consultationId: consultationId ?? undefined, responseStyle, mood, serious }),
        signal: ac.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAnswer(`*The oracle stumbled.* ${data.error ?? "Try again, brave soul."}`);
        return;
      }
      setSources(decodeSources(res.headers.get(SOURCES_HEADER)));
      const hid = res.headers.get("X-History-Id");
      if (hid) setHistoryId(Number(hid));
      const cid = res.headers.get("X-Consultation-Id");
      if (cid) setConsultationId(Number(cid));
      if (!res.body) {
        setAnswer("*silence* (no response)");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const splitter = new ReasoningSplitter();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const { answer: text, reasoning: thought } = splitter.push(decoder.decode(value, { stream: true }));
        if (thought) setReasoning((prev) => prev + thought);
        if (!text) continue;
        if (firstChunk) {
          firstChunk = false;
          sound.chime();
          setBurst((b) => b + 1);
        }
        setAnswer((prev) => prev + text);
        sound.typeTick();
        tts.feed(text);
      }
      tts.end();
      setStreamDone((n) => n + 1);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setAnswer("*The oracle stumbled.* Try again, brave soul.");
      }
    } finally {
      setStreaming(false);
    }
  }, [question, selectedId, consultationId, streaming, responseStyle, mood, serious]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") ask();
  }

  async function favorite() {
    if (historyId == null) return;
    const res = await apiFetch(`/api/history/${historyId}`, { method: "PATCH" });
    if (res.ok) {
      const data = await res.json();
      setFavorited(!!data.favorite);
    }
  }

  function toggleGeneratedQuips() {
    const next = !generatedQuipsOn;
    setGeneratedQuipsOn(next);
    localStorage.setItem("gnome.generatedQuips", next ? "1" : "0");
  }

  function offerMushroom() {
    const next = moods[Math.floor(Math.random() * moods.length)] ?? "default";
    changeMood(next);
    setFortune(`${selected?.name ?? "The oracle"} accepts the mushroom and becomes ${labelize(next)}.`);
    emitBackgroundPulse();
  }

  function generateFortune() {
    const fortunes = [
      "The path ahead contains one useful button and at least two suspicious detours.",
      "A small decision will soon become a story you tell with unnecessary confidence.",
      "Your future is bright, provided you stop asking the toaster for legal advice.",
      "A helpful stranger, a warm snack, and a lucky refresh are approaching.",
    ];
    setFortune(fortunes[Math.floor(Math.random() * fortunes.length)]);
    emitBackgroundPulse();
  }

  function newConsultation() {
    abortRef.current?.abort();
    tts.cancel();
    setConsultationId(null);
    setHistoryId(null);
    setAnswer("");
    setReasoning("");
    setSources([]);
    setQuestion("");
    setFortune("");
  }

  return (
    <main className="wrap">
      <div className="topbar">
        <h1 className="title">
          The Gnome Oracle <span className="spark">✨</span>
        </h1>
        <nav className="nav">
          <button
            className="iconbtn"
            onClick={() => setShowSettings((s) => !s)}
            title="Settings"
          >
            ⚙️ Settings
          </button>
          <Link className="navlink" href="/history">
            📜 History
          </Link>
          <Link className="navlink" href="/lab">
            🧪 Lab
          </Link>
          <Link className="navlink" href="/council">
            ⚖️ Council
          </Link>
        </nav>
      </div>

      {showSettings && (
        <div className="panel soundpanel">
          <div className="soundrow">
            <span className="iconbtn ghosticon">🔮</span>
            <span className="soundlabel">Avatar</span>
            <select
              value={avatarPref}
              onChange={(e) => changeAvatarPref(e.target.value as AvatarPref)}
            >
              {AVATAR_PREFS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {avatarPref !== "2d" && avatarPref !== "sprite" && (
            <div className="soundrow">
              <span className="iconbtn ghosticon">✦</span>
              <span className="soundlabel">Avatar quality</span>
              <select
                value={avatarQuality}
                onChange={(e) => changeAvatarQuality(e.target.value as AvatarQualityPref)}
              >
                {AVATAR_QUALITIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Critters now perform in the 2D renderer too, so this row is
              always shown. */}
          <SummonRow
            crittersOn={crittersOn}
            reducedMotion={reducedMotion}
            onToggle={toggleCritters}
            api={critterApi}
          />
          <div className="soundrow">
            <button className="iconbtn" onClick={toggleGeneratedQuips}>{generatedQuipsOn ? "🧠" : "💬"}</button>
            <span className="soundlabel">Generated critter quips</span>
            <span className="soundhint">{generatedQuipsOn ? "Uses the active AI connection" : "Canned lines only"}</span>
          </div>
          <div className="soundrow">
            <button className="iconbtn" onClick={toggleVoice}>
              {voiceOn ? "🔊" : "🔇"}
            </button>
            <span className="soundlabel">Wizard voice</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volumes.voice}
              disabled={!voiceOn}
              onChange={(e) => changeVolume("voice", Number(e.target.value))}
            />
          </div>
          <div className="soundrow">
            <button className="iconbtn" onClick={toggleMusic}>
              {musicOn ? "🎵" : "🔕"}
            </button>
            <span className="soundlabel">Music</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volumes.music}
              disabled={!musicOn}
              onChange={(e) => changeVolume("music", Number(e.target.value))}
            />
          </div>
          <div className="soundrow">
            <span className="iconbtn ghosticon">✨</span>
            <span className="soundlabel">Sound effects</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volumes.sfx}
              onChange={(e) => changeVolume("sfx", Number(e.target.value))}
            />
          </div>
          <div className="soundrow">
            <span className="iconbtn ghosticon">⌨️</span>
            <span className="soundlabel">Typing</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volumes.typing}
              onChange={(e) => changeVolume("typing", Number(e.target.value))}
            />
          </div>
          <BackgroundSettings />
          <ProviderSettings />
          <BackupSettings />
        </div>
      )}

      <p className="tagline">
        Ask anything. Receive vibes, riddles, and the bare minimum of an answer.
      </p>
      <div className="consultation-status">
        {consultationId ? <><span>Consultation #{consultationId}</span><button type="button" className="ghost" onClick={newConsultation}>New consultation</button></> : <span>New consultation</span>}
      </div>

      <div className="panel stage">
        <OracleAvatar
          speaking={speaking}
          appearance={selectedAppearance}
          burst={burst}
          streaming={streaming}
          answerText={answer}
          streamDone={streamDone}
          mood={mood}
          quality={avatarQualityProp}
          crittersEnabled={crittersOn}
          critterApiRef={critterApi}
          characterId={selectedId ?? undefined}
          voiceOn={voiceOn}
          reducedMotion={reducedMotion}
        />
        <div className={`bubble ${answer ? "" : "placeholder"}`}>
          {answer ||
            (speaking ? "The oracle stirs…" : "Pick a persona and ask me something silly.")}
        </div>
        <Pondering reasoning={reasoning} pondering={streaming && !answer} />
        <Sources sources={sources} />
        {fortune && <p className="fortune" role="status">🔮 {fortune}</p>}
        {answer && !streaming && (
          <div className="row answeractions">
            <button className="ghost favbtn" onClick={() => tts.replay(answer)}>
              🔁 Replay
            </button>
            {historyId != null && (
              <button className="ghost favbtn" onClick={favorite} disabled={favorited}>
                {favorited ? "⭐ Favorited" : "☆ Favorite this"}
              </button>
            )}
            <button className="ghost favbtn" onClick={() => exportProphecyCard(question, answer, selected?.name ?? "The Gnome Oracle", selected?.meta.appearance).catch((error) => setFortune(error.message))}>
              🖼️ Export card
            </button>
          </div>
        )}
        {!answer && !streaming && <div className="row quick-actions"><button className="ghost" onClick={generateFortune}>🔮 Read my fortune</button><button className="ghost" onClick={offerMushroom}>🍄 Offer a mushroom</button></div>}
      </div>

      <div className="controls">
        <label className="field">
          Persona
          <select
            value={selectedId ?? ""}
            onChange={(e) => onPersonaChange(Number(e.target.value))}
          >
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>
        {selected?.description && <p className="persona-desc">{selected.description}</p>}

        <div className="controlgrid">
          <label className="field">
            Outfit
            <div className="selectrow">
              <select
                value={outfitIndex}
                onChange={(e) => changeOutfit(Number(e.target.value))}
              >
                {outfits.map((_, i) => (
                  <option key={i} value={i}>
                    Outfit {i + 1}
                  </option>
                ))}
              </select>
              <button type="button" className="iconbtn" onClick={shuffleOutfit} title="Shuffle outfit">
                🎲
              </button>
            </div>
          </label>

          <label className="field">
            Body
            <select value={variantOverride} onChange={(e) => changeVariant(e.target.value)}>
              <option value="">Default</option>
              {AVATAR_VARIANTS.filter((v) => v !== "gnome").map((v) => (
                <option key={v} value={v}>
                  {labelize(v)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Response style
            <select
              value={responseStyle}
              onChange={(e) => changeResponseStyle(e.target.value as ResponseStyle)}
            >
              {RESPONSE_STYLES.map((style) => (
                <option key={style.value} value={style.value}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field" title="Cooler, more careful answers that are worked out step by step first. Slower, and less silly.">
            <span><input type="checkbox" checked={serious} onChange={(e) => toggleSerious(e.target.checked)} /> 🎓 Serious mode</span>
            <small className="muted">{serious ? "Accuracy first; answers take longer." : "Off: full-strength jokes."}</small>
          </label>

          <label className="field">
            Mood
            <select value={mood} onChange={(e) => changeMood(e.target.value)}>
              {moods.map((m) => (
                <option key={m} value={m}>
                  {labelize(m)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row">
          <input
            type="text"
            placeholder="Ask the oracle anything…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button onClick={ask} disabled={streaming || !question.trim()}>
            {streaming ? "Conjuring…" : "Ask the Oracle"}
          </button>
        </div>
        <div className="starter-row" aria-label="Question starters">
          {["Settle an argument: which option is secretly better?", "Give me dubious wisdom about today.", "Surprise me with a tiny prophecy."] .map((starter) => <button type="button" className="ghost starter" key={starter} onClick={() => setQuestion(starter)}>{starter.startsWith("Settle") ? "⚔️ Settle an argument" : starter.startsWith("Give") ? "🪄 Dubious wisdom" : "🎲 Surprise me"}</button>)}
        </div>
      </div>
    </main>
  );
}

function isResponseStyle(value: string | null): value is ResponseStyle {
  return value === "funny-useful" || value === "mostly-comedy" || value === "oracle-chaos";
}

function labelize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
