import type { CritterId } from "./catalog";

/**
 * Per-critter prompt text and offline fallback lines.
 *
 * SERVER ONLY — imported by `app/api/quip/route.ts` and nothing else. These
 * strings are several kB and the browser never needs them; keeping them out of
 * `catalog.ts` is what keeps "/" First Load JS flat.
 */
export interface CritterPrompt {
  /** Appended to the persona system prompt. */
  hint: string;
  /** Used when Ollama is unreachable, so ambient events still feel alive. */
  fallbackLines: string[];
}

export const CRITTER_PROMPTS: Record<CritterId, CritterPrompt> = {
  fairy: {
    hint: "A tiny glowing fairy is buzzing round your head, yanking your beard. React with brief, playful exasperation and a mock threat. ONE short line.",
    fallbackLines: [
      "Touch the beard again, sprite, and you'll be a rug.",
      "Shoo! That beard took four hundred years!",
      "I have spells for this. Small ones. Painful ones.",
    ],
  },
  imp: {
    hint: "A knee-high imp just swiped a trinket from your table and is cackling about it. React, indignant. ONE short line.",
    fallbackLines: [
      "That was MY lucky thimble, you gremlin.",
      "Put it back. I will count to one.",
      "Every century, the same little thief.",
    ],
  },
  raincloud: {
    hint: "A small grumpy storm cloud has parked directly above your head and started drizzling on you. React, long-suffering. ONE short line.",
    fallbackLines: [
      "Oh good. My own personal weather.",
      "Go rain on someone with a hat budget.",
      "This is the third one this week.",
    ],
  },
  dragon: {
    hint: "A dog-sized dragon just thudded down in front of you, snorting smoke. You're wary but acting unbothered. ONE short line.",
    fallbackLines: [
      "Easy. Easy. We are both being very reasonable.",
      "Lovely scales. Please don't set fire to the rug.",
      "I've fought bigger. I've also run from smaller.",
    ],
  },
  crow: {
    hint: "A crow just stole your hat and is hopping away with it. React, outraged. ONE short line.",
    fallbackLines: [
      "That hat is load-bearing! Bring it back!",
      "Thief! Feathered, beady-eyed thief!",
      "Fine. Keep it. It never fit anyway. IT DID FIT.",
    ],
  },
  gust: {
    hint: "A sudden gust of wind just blew through and nearly took your hat off. React, startled then grumbling. ONE short line.",
    fallbackLines: [
      "Gah! Who left the sky open?",
      "My hat! My dignity! Mostly my hat!",
      "A little warning next time, weather.",
    ],
  },
  deer: {
    hint: "A gentle deer wandered up and is watching you. Pause and react softly, almost fondly. ONE short line.",
    fallbackLines: [
      "Well. Hello, you.",
      "Careful out there, little one.",
      "No questions from you. That's refreshing.",
    ],
  },
  moth: {
    hint: "A big pale moth is circling the glow of your staff. React gently, a little charmed. ONE short line.",
    fallbackLines: [
      "Yes, yes, it's very bright. Mind the wings.",
      "You and I want the same thing, friend. Light.",
      "Go on then. Have your moment.",
    ],
  },
  fireflies: {
    hint: "A swarm of fireflies has gathered in front of you and is drifting into a shape. React with quiet delight. ONE short line.",
    fallbackLines: [
      "Show-offs. Beautiful show-offs.",
      "Now THAT is how you make an entrance.",
      "Careful, you'll put the stars out of work.",
    ],
  },
  toad: {
    hint: "A fat toad has sat down in front of you, blinked once, and croaked. React, deadpan and fond. ONE short line.",
    fallbackLines: [
      "Profound. Truly. Thank you.",
      "That's the most sense anyone's made all day.",
      "Sit there as long as you like.",
    ],
  },
  snail: {
    hint: "A snail is very slowly crossing in front of you. React with fond impatience — you may call it your pet. ONE short line.",
    fallbackLines: [
      "Take your time. Really. I've got centuries.",
      "That's my boy. Two more hours and you're across.",
      "I have watched empires fall faster than this.",
    ],
  },
  wisp: {
    hint: "A will-o'-wisp just bobbed up right behind your shoulder without a sound. React, startled, then play it off. ONE short line.",
    fallbackLines: [
      "AH— ahem. I knew you were there.",
      "Don't DO that. I'm four hundred years old.",
      "One day you'll sneak up on someone with a weak heart.",
    ],
  },
};

export function pickFallbackLine(id: CritterId): string {
  const lines = CRITTER_PROMPTS[id].fallbackLines;
  return lines[Math.floor(Math.random() * lines.length)];
}
