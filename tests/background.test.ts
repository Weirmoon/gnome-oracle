import test from "node:test";
import assert from "node:assert/strict";
import { BACKGROUND_PRESETS, defaultBackgroundDocument, parseBackgroundConfig, parseBackgroundDocument, parseBackgroundFile } from "../lib/background";

test("legacy installations retain gradient and fresh installs start with subtle constellations", () => {
  const old = defaultBackgroundDocument(true);
  const fresh = defaultBackgroundDocument(false);
  assert.equal(old.config.effect, "gradient");
  assert.equal(fresh.config.effect, "constellations");
  assert.ok(fresh.config.brightness < 0.5);
  fresh.config.density = 1;
  assert.notEqual(defaultBackgroundDocument(false).config.density, 1);
});

test("every built-in background survives a portable JSON round trip with custom presets", () => {
  for (const preset of BACKGROUND_PRESETS) {
    const document = { version: 1 as const, config: preset.config, presets: [{ ...preset, id: `custom-${preset.id}` }] };
    assert.deepEqual(parseBackgroundFile(JSON.stringify(document)), document);
  }
});

test("untrusted imports reject dangerous colors, runaway simulation values and future versions", () => {
  const document = defaultBackgroundDocument(false);
  assert.throws(() => parseBackgroundDocument({ ...document, version: 2 }), /version/);
  for (const invalid of [
    { backgroundColor: "url(https://example.test/track)" }, { accentColor: "red" },
    { effect: "unknown" }, { quality: "maximum" }, { particleInteraction: "explode" },
    { density: 100000 }, { connectionDistance: Infinity }, { speed: -1 },
    { brightness: Number.NaN }, { glyphs: "" }, { glyphs: "a\nb" }, { glyphs: "a".repeat(81) },
  ]) {
    assert.throws(() => parseBackgroundConfig({ ...document.config, ...invalid }));
  }
  assert.throws(() => parseBackgroundFile("x".repeat(100001)), /100 KB/);
  assert.throws(() => parseBackgroundFile("not json"), /JSON/);
});

test("imports validate collections and only retain documented visual settings", () => {
  const document = defaultBackgroundDocument(false);
  const preset = { id: "custom-demo", name: "A world", config: document.config };
  assert.throws(() => parseBackgroundDocument({ ...document, presets: [preset, preset] }), /unique/);
  assert.throws(() => parseBackgroundDocument({ ...document, presets: [{ ...preset, id: "matrix" }] }), /unique/);
  assert.throws(() => parseBackgroundDocument({ ...document, presets: [{ ...preset, name: " " }] }), /names/);
  assert.throws(() => parseBackgroundDocument({ ...document, presets: Array.from({ length: 41 }, (_, i) => ({ ...preset, id: `custom-${i}` })) }), /40/);
  const parsed = parseBackgroundDocument({ ...document, apiKey: "discard-me", config: { ...document.config, unexpected: "discard-me" } });
  assert.equal(JSON.stringify(parsed).includes("discard-me"), false);
});
