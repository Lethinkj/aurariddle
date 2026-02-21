import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin, broadcastToEvent } from "@/lib/supabase";

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "hardword_admin_secret_2024";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === SESSION_SECRET;
}

// POST: Control the event flow (start, next_question, end)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;

  try {
    const { action } = await req.json();
    const supabase = getSupabaseAdmin();

    // Fetch event
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Fetch questions
    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("event_id", eventId)
      .order("question_order", { ascending: true });

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: "No questions in this event" }, { status: 400 });
    }

    switch (action) {
      case "start": {
        if (event.status !== "draft") {
          return NextResponse.json({ error: "Event already started" }, { status: 400 });
        }

        // Set event to active, no question shown yet
        await supabase
          .from("events")
          .update({
            status: "active",
            current_question_id: null,
            current_question_index: -1,
          })
          .eq("id", eventId);

        await broadcastToEvent(eventId, "event-update", { status: "active" });
        return NextResponse.json({ success: true, status: "active" });
      }

      case "next_question": {
        if (event.status !== "active") {
          return NextResponse.json({ error: "Event is not active" }, { status: 400 });
        }

        const nextIndex = event.current_question_index + 1;

        if (nextIndex >= questions.length) {
          // No more questions - end event
          await supabase
            .from("questions")
            .update({ is_active: false })
            .eq("event_id", eventId);

          await supabase
            .from("events")
            .update({
              status: "completed",
              current_question_id: null,
              current_question_index: questions.length,
            })
            .eq("id", eventId);

          await broadcastToEvent(eventId, "event-update", { status: "completed" });
          return NextResponse.json({ success: true, status: "completed" });
        }

        const nextQuestion = questions[nextIndex];

        // Deactivate previous question
        if (event.current_question_id) {
          await supabase
            .from("questions")
            .update({ is_active: false })
            .eq("id", event.current_question_id);
        }

        // Activate next question
        await supabase
          .from("questions")
          .update({ is_active: true })
          .eq("id", nextQuestion.id);

        // Update event
        await supabase
          .from("events")
          .update({
            current_question_id: nextQuestion.id,
            current_question_index: nextIndex,
          })
          .eq("id", eventId);

        await broadcastToEvent(eventId, "event-update", { action: "next_question", questionIndex: nextIndex });
        return NextResponse.json({
          success: true,
          current_question_index: nextIndex,
          total_questions: questions.length,
        });
      }

      case "end": {
        // Deactivate all questions
        await supabase
          .from("questions")
          .update({ is_active: false })
          .eq("event_id", eventId);

        // End event
        await supabase
          .from("events")
          .update({
            status: "completed",
            current_question_id: null,
          })
          .eq("id", eventId);

        await broadcastToEvent(eventId, "event-update", { status: "completed" });
        return NextResponse.json({ success: true, status: "completed" });
      }

      case "reactivate": {
        if (event.status !== "completed") {
          return NextResponse.json({ error: "Only completed events can be reactivated" }, { status: 400 });
        }

        // Reset event back to draft
        await supabase
          .from("events")
          .update({
            status: "draft",
            current_question_id: null,
            current_question_index: -1,
          })
          .eq("id", eventId);

        // Reset all questions to inactive
        await supabase
          .from("questions")
          .update({ is_active: false })
          .eq("event_id", eventId);

        await broadcastToEvent(eventId, "event-update", { status: "draft" });
        return NextResponse.json({ success: true, status: "draft" });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
