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

  return NextResponse.json({
    leaderboard: participants || [],
  });
}
