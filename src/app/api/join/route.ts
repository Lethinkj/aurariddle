import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, broadcastToEvent } from "@/lib/supabase";

// POST: Join an event as a participant
export async function POST(req: NextRequest) {
  try {
    const { event_code, name } = await req.json();

    if (!event_code?.trim() || !name?.trim()) {
      return NextResponse.json(
        { error: "Event code and name are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Find event by code
    const { data: event } = await supabase
      .from("events")
      .select("id, status, name")
      .eq("code", event_code.trim().toUpperCase())
      .single();

    if (!event) {
      return NextResponse.json({ error: "Event not found. Check your code!" }, { status: 404 });
    }

    if (event.status === "completed") {
      return NextResponse.json({ error: "This event has already ended" }, { status: 400 });
    }

    // Check if name is already taken in this event
    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("event_id", event.id)
      .eq("name", name.trim())
      .single();

    if (existing) {
      // Return existing participant (allow rejoin)
      return NextResponse.json({
        participant_id: existing.id,
        event_id: event.id,
        event_name: event.name,
        rejoined: true,
      });
    }

    // Create new participant
    const { data: participant, error } = await supabase
      .from("participants")
      .insert({
        event_id: event.id,
        name: name.trim(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Broadcast new player joined
    await broadcastToEvent(event.id, "participant-joined", { name: name.trim() });

    return NextResponse.json({
      participant_id: participant.id,
      event_id: event.id,
      event_name: event.name,
      rejoined: false,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
