"use client";
import type { SearchSource } from "@/lib/search/format";

/** Links the oracle's answer drew on when web search was switched on. */
export default function Sources({ sources }: { sources: SearchSource[] }) {
  if (!sources.length) return null;
  return <details className="sources">
    <summary>🔎 Looked up {sources.length} source{sources.length === 1 ? "" : "s"}</summary>
    <ol>{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer nofollow">{source.title}</a> <span className="muted">{new URL(source.url).hostname}</span></li>)}</ol>
  </details>;
}
