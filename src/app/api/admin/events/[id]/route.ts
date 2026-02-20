import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "hardword_admin_secret_2024";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === SESSION_SECRET;
}

// GET: Get event details with questions and participants
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Fetch event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Fetch questions
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("event_id", id)
    .order("question_order", { ascending: true });

  // Fetch participants
  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", id)
    .order("score", { ascending: false });

  // If requesting answers for a specific question
  const answersFor = req.nextUrl.searchParams.get("answers_for");
  let currentAnswers: { participant_name: string; points: number; time: string }[] = [];

  if (answersFor) {
    const { data: answers } = await supabase
      .from("answers")
      .select("*, participant:participants(name)")
      .eq("question_id", answersFor)
      .eq("is_correct", true)
      .order("answered_at", { ascending: true });

    if (answers) {
      currentAnswers = answers.map((a: Record<string, unknown>) => ({
        participant_name: (a.participant as Record<string, string>)?.name || "Unknown",
        points: a.points_awarded as number,
        time: a.answered_at as string,
      }));
    }
  }

  return NextResponse.json({
    event,
    questions: questions || [],
    participants: participants || [],
    current_answers: currentAnswers,
  });
}
