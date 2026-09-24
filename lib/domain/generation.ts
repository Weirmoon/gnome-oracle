import {
  normalizeMeta,
  HAT_STYLES,
  SFX_THEMES,
  COSTUME_ACCESSORIES,
  HAIR_STYLES,
  FACE_FEATURES,
  TORSO_STYLES,
  BACK_ITEMS,
  HELD_ITEMS,
  COSTUME_PATTERNS,
  AVATAR_VARIANTS,
} from "../persona";

export function buildPrompt(vibe: string): string {
  return (
    "You are a creative character designer for a silly meme website where an on-screen " +
    "wizard/gnome answers questions in funny personas. Invent ONE new persona based on this vibe: " +
    `"${vibe}".\n\n` +
    "Respond with ONLY a JSON object with exactly these keys:\n" +
    "{\n" +
    '  "name": short catchy persona name (2-4 words),\n' +
    '  "emoji": a single emoji that fits,\n' +
    '  "description": one short sentence describing how it talks,\n' +
    '  "system_prompt": detailed instructions telling the model how to act as this persona. ' +
    "It MUST stay in character, keep replies to 2-3 sentences, be silly/funny, and give only the " +
    "bare minimum of a real answer.,\n" +
    '  "temperature": a number from 0.6 to 1.2 (higher = wackier),\n' +
    '  "appearance": { "hat": one of ' +
    JSON.stringify(HAT_STYLES) +
    ', "hatColor": hex color, "robeColor": hex color, "beardColor": hex color, ' +
    '"skin": hex color, "accent": hex color (used for glow/sparkles), "variant": one of ' + JSON.stringify(AVATAR_VARIANTS) + ', "accessory": one of ' +
    JSON.stringify(COSTUME_ACCESSORIES) +
    ', "hair": one of ' +
    JSON.stringify(HAIR_STYLES) +
    ', "faceFeature": one of ' +
    JSON.stringify(FACE_FEATURES) +
    ', "torsoStyle": one of ' +
    JSON.stringify(TORSO_STYLES) +
    ', "backItem": one of ' +
    JSON.stringify(BACK_ITEMS) +
    ', "heldItem": one of ' +
    JSON.stringify(HELD_ITEMS) +
    ', "pattern": one of ' +
    JSON.stringify(COSTUME_PATTERNS) +
    " },\n" +
    '  "appearanceVariants": array of 4 appearance objects using the same shape as "appearance",\n' +
    '  "voice": { "rate": number 0.7 to 1.4 (speech speed), "pitch": number 0.6 to 1.6 (speech pitch) },\n' +
    '  "sfx": one of ' +
    JSON.stringify(SFX_THEMES) +
    ' (the sound-effect flavor that best matches the vibe),\n' +
    '  "moods": array of 3-5 short lowercase mood names\n' +
    "}\n" +
    "Pick colors, costumes, accessories, moods, and an sfx flavor that match the vibe. Do not include any text outside the JSON object."
  );
}

