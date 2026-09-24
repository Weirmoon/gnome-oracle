"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Council from "@/components/Council";
import { apiFetch } from "@/lib/platform/client";
import type { Character } from "@/lib/domain/types";

export default function CouncilPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [resume, setResume] = useState(0);
  useEffect(() => { setResume(Number(new URLSearchParams(window.location.search).get("resume"))); }, []);
  useEffect(() => { apiFetch("/api/characters").then(r => r.json()).then(setCharacters).catch(() => {}); }, []);
  return <main className="wrap"><div className="topbar"><h1 className="title">Oracle Council <span className="spark">⚖️</span></h1><Link className="navlink" href="/">← Back to the Oracle</Link></div><p className="tagline">Invite three distinct voices, then let them argue politely with the cosmos.</p><Council characters={characters} resumeId={Number.isInteger(resume) && resume > 0 ? resume : undefined} /></main>;
}
