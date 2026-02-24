import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: Get leaderboard for an event
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: participants } = await supabase
    .from("participants")
    .select("id, name, score")
    .eq("event_id", eventId)
    .order("score", { ascending: false });

  // Fetch total time per participant (sum of time_taken_ms for correct answers)
  const { data: answers } = await supabase
    .from("answers")
    .select("participant_id, time_taken_ms, is_correct, question_id!inner(event_id)")
    .eq("question_id.event_id", eventId)
    .eq("is_correct", true);

  // Build a map of participant_id -> total_time_ms
  const timeMap: Record<string, number> = {};
  if (answers) {
    for (const a of answers) {
      if (a.time_taken_ms != null) {
        timeMap[a.participant_id] = (timeMap[a.participant_id] || 0) + a.time_taken_ms;
      }
    }
  }

  const leaderboard = (participants || []).map((p) => ({
    ...p,
    total_time_ms: timeMap[p.id] || null,
  }));

  return NextResponse.json({
    leaderboard,
  });
}
