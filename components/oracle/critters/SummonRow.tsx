"use client";

import { CRITTER_LIST } from "./catalog";
import type { CritterApi } from "./useCritterEvents";

/**
 * Settings rows for ambient critters.
 *
 * Split out and dynamically imported so the 12-entry catalog never lands in the
 * initial "/" bundle — it is only needed once the settings panel is opened.
 */
export default function SummonRow({
  crittersOn,
  reducedMotion,
  onToggle,
  api,
}: {
  crittersOn: boolean;
  reducedMotion: boolean;
  onToggle: () => void;
  api: React.RefObject<CritterApi | null>;
}) {
  return (
    <>
      <div className="soundrow">
        <button className="iconbtn" onClick={onToggle} disabled={reducedMotion}>
          {crittersOn ? "🦋" : "🚫"}
        </button>
        <span className="soundlabel">Ambient critters</span>
        <span className="soundhint">
          {reducedMotion ? "off (reduced motion)" : crittersOn ? "on" : "off"}
        </span>
      </div>
      <div className="soundrow critterrow">
        <span className="soundlabel">Summon</span>
        <div className="critterbuttons">
          {CRITTER_LIST.map((c) => (
            <button
              key={c.id}
              className="critterbtn"
              title={`Summon the ${c.name.toLowerCase()} (or type /${c.id})`}
              onClick={() => api.current?.summon(c.id)}
            >
              <span aria-hidden="true">{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
