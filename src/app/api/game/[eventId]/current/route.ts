import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: Get current question for players (without revealing the answer)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = getSupabaseAdmin();

  // Fetch event
  const { data: event } = await supabase
    .from("events")
    .select("id, status, current_question_id, current_question_index, name")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get total questions count
  const { count: totalQuestions } = await supabase
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (!event.current_question_id || event.status !== "active") {
    return NextResponse.json(
      {
        event_status: event.status,
        event_name: event.name,
        current_question: null,
        total_questions: totalQuestions || 0,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  // Fetch current question
  const { data: question } = await supabase
    .from("questions")
    .select("id, question_text, answer, question_order")
    .eq("id", event.current_question_id)
    .single();

  if (!question) {
    return NextResponse.json(
      {
        event_status: event.status,
        event_name: event.name,
        current_question: null,
        total_questions: totalQuestions || 0,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  // Calculate answer pattern (word lengths) without revealing the answer
  const words = question.answer.split(" ");
  const answerPattern = words.map((w: string) => w.length);

  return NextResponse.json(
    {
      event_status: event.status,
      event_name: event.name,
      current_question: {
        id: question.id,
        question_text: question.question_text,
        answer_pattern: answerPattern,
        question_order: question.question_order,
        total_questions: totalQuestions || 0,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
