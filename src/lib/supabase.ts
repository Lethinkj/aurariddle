import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Singleton browser client (avoids multiple GoTrueClient instances)
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser() {
  if (browserClient) return browserClient;
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}

// Server-side Supabase client (uses service role key, bypasses RLS)
// Each request gets its own client to avoid sharing state across requests
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Types
export interface Event {
  id: string;
  name: string;
  code: string;
  status: "draft" | "active" | "completed";
  current_question_id: string | null;
  current_question_index: number;
  created_at: string;
}

export interface Question {
  id: string;
  event_id: string;
  question_text: string;
  answer: string;
  question_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Participant {
  id: string;
  event_id: string;
  name: string;
  score: number;
  joined_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  participant_id: string;
  is_correct: boolean;
  points_awarded: number;
  answered_at: string;
}

// Question data sent to players (no answer revealed)
export interface QuestionPublic {
  id: string;
  question_text: string;
  answer_pattern: number[]; // word lengths e.g. [3, 4] for "NEW YORK"
  question_order: number;
  total_questions: number;
}

export function generateEventCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
