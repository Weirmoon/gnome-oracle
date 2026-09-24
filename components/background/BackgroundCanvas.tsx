"use client";

import { useEffect, useRef } from "react";
import { BACKGROUND_PULSE_EVENT, type BackgroundConfig } from "@/lib/background";

type Particle = { x: number; y: number; vx: number; vy: number; radius: number; phase: number };
type RainColumn = { x: number; y: number; speed: number; glyph: number };
type Pulse = { x: number; y: number; age: number };

/** The renderer owns its simulation; animation never schedules React updates. */
export function BackgroundCanvas({ config, preview = false }: { config: BackgroundConfig; preview?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motion.matches;
    let width = 1;
    let height = 1;
    let frame = 0;
    let lastTime = 0;
    let time = 0;
    let suspended = false;
    let adaptiveDensity = 1;
    let observedFrames = 0;
    let observedTime = 0;
    let adjustmentTime = 0;
    let particles: Particle[] = [];
    let columns: RainColumn[] = [];
    let pulses: Pulse[] = [];
    const pointer = { x: 0, y: 0, active: false };
    const glyphs = [...config.glyphs];
    const maximum = config.quality === "low" ? 60 : config.quality === "high" ? 180 : 110;
    const targetFrames = config.quality === "low" ? 30 : 60;
    // A repeatable field also makes reduced-motion previews stable across visits.
    let seed = 7193;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    function initialize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const pixelCap = Math.sqrt(4_000_000 / (width * height));
      const dpr = Math.min(window.devicePixelRatio || 1, config.quality === "high" ? 2 : config.quality === "low" ? 1 : 1.5, pixelCap);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(8, Math.round(Math.min(maximum, width * height / 8500) * config.density));
      seed = 7193;
      particles = Array.from({ length: count }, () => ({ x: random() * width, y: random() * height, vx: (random() - 0.5) * 16, vy: (random() - 0.5) * 16, radius: 0.8 + random() * 1.9, phase: random() * Math.PI * 2 }));
      const columnCount = Math.min(180, Math.max(5, Math.round(width / 17 * config.density)));
      columns = Array.from({ length: columnCount }, (_, index) => ({ x: (index + 0.5) * width / columnCount, y: random() * (height + 240) - 120, speed: 28 + random() * 55, glyph: Math.floor(random() * glyphs.length) }));
      pulses = [];
      draw(0, true);
    }

    function draw(delta: number, staticFrame = false) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      if (config.effect === "gradient") return;
      ctx.fillStyle = config.accentColor;
      ctx.strokeStyle = config.accentColor;
      ctx.lineWidth = 0.7;
      const dt = staticFrame ? 0 : delta * config.speed;
      const active = pointer.active && !reducedMotion && config.interactionStrength > 0;
      const strength = config.interactionStrength;

      if (config.effect === "matrix") {
        ctx.font = "14px ui-monospace, monospace";
        const count = Math.ceil(columns.length * adaptiveDensity);
        for (let index = 0; index < count; index++) {
          const column = columns[index];
          column.y += dt * column.speed;
          if (column.y > height + 230) { column.y = -20; column.glyph = (column.glyph + 1) % glyphs.length; }
          const separation = active ? column.x - pointer.x : 1000;
          const deflection = Math.abs(separation) < 150 ? Math.sign(separation || 1) * (1 - Math.abs(separation) / 150) * strength * 48 : 0;
          for (let trail = 0; trail < 14; trail++) {
            const y = column.y - trail * 17;
            if (y < -17 || y > height + 17) continue;
            const influence = active ? Math.max(0, 1 - Math.abs(y - pointer.y) / 180) : 0;
            ctx.globalAlpha = config.brightness * (1 - trail / 14) * (trail === 0 ? 1 : 0.65);
            ctx.fillText(glyphs[(column.glyph + trail * 7 + Math.floor(time * 2)) % glyphs.length], column.x + deflection * influence, y);
          }
        }
      } else {
        const count = Math.ceil(particles.length * adaptiveDensity);
        for (let index = 0; index < count; index++) {
          const particle = particles[index];
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          if (active) {
            const dx = pointer.x - particle.x;
            const dy = pointer.y - particle.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 5 && distance < 170) {
              const direction = config.effect === "particles" && config.particleInteraction === "repel" ? -1 : 1;
              const force = (1 - distance / 170) * strength * dt * 35 * direction;
              particle.x += dx / distance * force;
              particle.y += dy / distance * force;
            }
          }
          if (particle.x < -10) particle.x = width + 10;
          if (particle.x > width + 10) particle.x = -10;
          if (particle.y < -10) particle.y = height + 10;
          if (particle.y > height + 10) particle.y = -10;
          if (config.effect === "constellations") {
            for (let other = index + 1; other < count; other++) {
              const neighbor = particles[other];
              const distance = Math.hypot(particle.x - neighbor.x, particle.y - neighbor.y);
              if (distance < config.connectionDistance) {
                ctx.globalAlpha = config.brightness * 0.45 * (1 - distance / config.connectionDistance);
                ctx.beginPath(); ctx.moveTo(particle.x, particle.y); ctx.lineTo(neighbor.x, neighbor.y); ctx.stroke();
              }
            }
            if (active) {
              const distance = Math.hypot(particle.x - pointer.x, particle.y - pointer.y);
              if (distance < 190) {
                ctx.globalAlpha = config.brightness * strength * (1 - distance / 190);
                ctx.beginPath(); ctx.moveTo(particle.x, particle.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke();
              }
            }
          } else {
            ctx.globalAlpha = config.brightness * 0.08;
            ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius * 6, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = config.brightness * 0.18;
            ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius * 3, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = config.brightness * (0.65 + Math.sin(time * config.speed + particle.phase) * 0.25);
          ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (!reducedMotion) {
        pulses = pulses.filter((pulse) => pulse.age < 1.2);
        for (const pulse of pulses) {
          pulse.age += delta;
          ctx.globalAlpha = Math.max(0, 1 - pulse.age / 1.2) * config.brightness * 0.7;
          for (let index = 0; index < 12; index++) {
            const angle = index / 12 * Math.PI * 2;
            const radius = 12 + pulse.age * 65;
            ctx.beginPath(); ctx.arc(pulse.x + Math.cos(angle) * radius, pulse.y + Math.sin(angle) * radius, 1.5, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function animate(timestamp: number) {
      if (document.hidden || suspended || reducedMotion || config.effect === "gradient") { frame = 0; return; }
      frame = requestAnimationFrame(animate);
      if (!lastTime) { lastTime = timestamp; return; }
      const elapsed = timestamp - lastTime;
      if (elapsed < 1000 / targetFrames - 1) return;
      lastTime = timestamp;
      time += Math.min(elapsed / 1000, 0.05);
      if (config.quality === "auto") {
        observedFrames++; observedTime += elapsed;
        if (timestamp - adjustmentTime > 3000 && observedFrames > 20) {
          if (observedTime / observedFrames > 28) adaptiveDensity = Math.max(0.3, adaptiveDensity * 0.8);
          observedFrames = 0; observedTime = 0; adjustmentTime = timestamp;
        }
      }
      draw(Math.min(elapsed / 1000, 0.05));
    }

    function resume() {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      if (reducedMotion || config.effect === "gradient") draw(0, true);
      else if (!document.hidden && !suspended) frame = requestAnimationFrame(animate);
    }
    function move(event: PointerEvent) {
      if (!canvas || reducedMotion) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top;
      pointer.active = pointer.x >= 0 && pointer.x <= width && pointer.y >= 0 && pointer.y <= height;
    }
    function clearPointer() { pointer.active = false; }
    function pointerUp(event: PointerEvent) { if (event.pointerType !== "mouse") clearPointer(); }
    function addPulse(x: number, y: number) {
      if (reducedMotion || config.effect === "gradient" || config.interactionStrength === 0 || document.hidden) return;
      pulses.push({ x, y, age: 0 });
      if (pulses.length > 5) pulses.shift();
    }
    function click(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, label, summary, [role='button'], [contenteditable]")) return;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left; const y = event.clientY - rect.top;
      if (x >= 0 && x <= width && y >= 0 && y <= height) addPulse(x, y);
    }
    function pulse(event: Event) {
      const detail = (event as CustomEvent<{ x?: number; y?: number }>).detail;
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      addPulse(typeof detail?.x === "number" ? detail.x - rect.left : width / 2, typeof detail?.y === "number" ? detail.y - rect.top : height * 0.35);
    }
    function motionChange() { reducedMotion = motion.matches; pointer.active = false; pulses = []; resume(); }
    function suspend() { suspended = true; resume(); }
    function wake() { suspended = false; resume(); }
    const observer = new ResizeObserver(initialize);
    observer.observe(canvas);
    initialize(); resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", wake);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    window.addEventListener("pointerup", pointerUp, { passive: true });
    window.addEventListener("pointercancel", clearPointer, { passive: true });
    window.addEventListener("blur", clearPointer);
    document.addEventListener("pointerleave", clearPointer);
    window.addEventListener("click", click, { passive: true });
    if (!preview) window.addEventListener(BACKGROUND_PULSE_EVENT, pulse);
    motion.addEventListener("change", motionChange);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pagehide", suspend); window.removeEventListener("pageshow", wake);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerdown", move);
      window.removeEventListener("pointerup", pointerUp); window.removeEventListener("pointercancel", clearPointer);
      window.removeEventListener("blur", clearPointer); document.removeEventListener("pointerleave", clearPointer);
      window.removeEventListener("click", click); window.removeEventListener(BACKGROUND_PULSE_EVENT, pulse);
      motion.removeEventListener("change", motionChange);
    };
  }, [config, preview]);

  return <canvas ref={canvasRef} className={preview ? "background-preview-canvas" : "background-world-canvas"} aria-hidden="true" />;
}
