import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin, generateEventCode } from "@/lib/supabase";

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "hardword_admin_secret_2024";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === SESSION_SECRET;
}

// GET: List all events
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data });
}

// POST: Create a new event
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Event name is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Generate unique event code
    let code = generateEventCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("code", code)
        .single();

      if (!existing) break;
      code = generateEventCode();
      attempts++;
    }

    const { data, error } = await supabase
      .from("events")
      .insert({ name: name.trim(), code })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event: data });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
