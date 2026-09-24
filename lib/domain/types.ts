import type { PersonaMeta } from "../persona";
export interface Character {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  system_prompt: string;
  temperature: number;
  created_at: string;
  is_seed: number; // 1 = built-in (cannot be deleted), 0 = user/AI created
  meta: PersonaMeta; // always populated (parsed or derived)
}

export type NewCharacter = {
  name: string;
  emoji: string;
  description: string;
  system_prompt: string;
  temperature?: number;
  is_seed?: boolean;
  meta?: PersonaMeta;
};

export interface HistoryRow {
  id: number;
  character_id: number | null;
  persona_name: string;
  persona_emoji: string;
  question: string;
  answer: string;
  favorite: number;
  created_at: string;
}

