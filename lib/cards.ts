import { exportFile } from "./platform/client";

export function wrapCardText(ctx: Pick<CanvasRenderingContext2D, "measureText">, text: string, width: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (ctx.measureText(line ? `${line} ${word}` : word).width <= width) { line = line ? `${line} ${word}` : word; continue; }
      if (line) result.push(line); line = "";
      for (const glyph of Array.from(word)) {
        if (line && ctx.measureText(line + glyph).width > width) { result.push(line); line = ""; }
        line += glyph;
      }
    }
    result.push(line);
  }
  return result;
}

export async function exportProphecyCard(question: string, answer: string, name: string, appearance?: { hatColor?: string; robeColor?: string; skin?: string; accent?: string }) {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable.");
  const width = 1000, textWidth = 800;
  ctx.font = "26px Georgia"; const q = wrapCardText(ctx, question, textWidth);
  ctx.font = "30px Georgia"; const a = wrapCardText(ctx, answer, textWidth);
  ctx.font = "bold 32px Georgia"; const names = wrapCardText(ctx, name, textWidth);
  canvas.width = width; canvas.height = 460 + names.length * 40 + q.length * 36 + a.length * 43;
  ctx.fillStyle = "#191129"; ctx.fillRect(0, 0, width, canvas.height);
  ctx.strokeStyle = "#d8b879"; ctx.lineWidth = 3; ctx.strokeRect(28, 28, width - 56, canvas.height - 56); ctx.lineWidth = 1; ctx.strokeRect(42, 42, width - 84, canvas.height - 84);
  for (const x of [54, width - 54]) for (const y of [54, canvas.height - 54]) { ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y); ctx.closePath(); ctx.fillStyle = "#d8b879"; ctx.fill(); }
  // Dedicated portrait, independent of the live WebGL canvas and its frame timing.
  ctx.fillStyle = appearance?.robeColor ?? "#7352ad"; ctx.beginPath(); ctx.ellipse(500, 233, 70, 55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = appearance?.skin ?? "#efc5a1"; ctx.beginPath(); ctx.arc(500, 170, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e7e1f3"; ctx.beginPath(); ctx.moveTo(464, 186); ctx.lineTo(500, 258); ctx.lineTo(536, 186); ctx.fill();
  ctx.fillStyle = appearance?.hatColor ?? "#9a76db"; ctx.beginPath(); ctx.moveTo(450, 153); ctx.lineTo(497, 66); ctx.lineTo(550, 153); ctx.fill();
  ctx.fillStyle = "#272035"; for (const x of [486, 514]) { ctx.beginPath(); ctx.arc(x, 174, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.textAlign = "center"; ctx.fillStyle = "#e3c788"; ctx.font = "bold 32px Georgia";
  let y = 320; for (const line of names) { ctx.fillText(line, 500, y); y += 40; }
  ctx.textAlign = "left"; ctx.font = "26px Georgia"; ctx.fillStyle = "#bcaacf"; y += 25;
  for (const line of q) { ctx.fillText(line, 100, y); y += 36; }
  y += 25; ctx.font = "30px Georgia"; ctx.fillStyle = "#fff4df";
  for (const line of a) { ctx.fillText(line, 100, y); y += 43; }
  ctx.textAlign = "center"; ctx.fillStyle = "#ac91c1"; ctx.font = "18px Georgia"; ctx.fillText("THE GNOME ORACLE", 500, canvas.height - 74);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("The card is too large to export on this device.")), "image/png"));
  await exportFile("gnome-prophecy.png", blob);
}
