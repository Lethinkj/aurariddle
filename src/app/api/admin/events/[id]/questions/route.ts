import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin, broadcastToEvent } from "@/lib/supabase";

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "hardword_admin_secret_2024";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === SESSION_SECRET;
}

// POST: Add a question to an event
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;

  try {
    const { question_text, answer } = await req.json();

    if (!question_text?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { error: "Question and answer are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check event exists and is in draft
    const { data: event } = await supabase
      .from("events")
      .select("status")
      .eq("id", eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "draft") {
      return NextResponse.json(
        { error: "Can only add questions to draft events" },
        { status: 400 }
      );
    }

    // Get the next question order
    const { data: existingQuestions } = await supabase
      .from("questions")
      .select("question_order")
      .eq("event_id", eventId)
      .order("question_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existingQuestions && existingQuestions.length > 0
        ? existingQuestions[0].question_order + 1
        : 0;

    const { data, error } = await supabase
      .from("questions")
      .insert({
        event_id: eventId,
        question_text: question_text.trim(),
        answer: answer.trim().toUpperCase(),
        question_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await broadcastToEvent(eventId, "questions-update", { action: "added" });
    return NextResponse.json({ question: data });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// DELETE: Remove a question
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;

  try {
    const { question_id } = await req.json();

    const supabase = getSupabaseAdmin();

    // Check event is in draft
    const { data: event } = await supabase
      .from("events")
      .select("status")
      .eq("id", eventId)
      .single();

    if (event?.status !== "draft") {
      return NextResponse.json(
        { error: "Can only delete questions from draft events" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", question_id)
      .eq("event_id", eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await broadcastToEvent(eventId, "questions-update", { action: "deleted" });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
