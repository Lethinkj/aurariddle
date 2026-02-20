import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// POST: Submit an answer
export async function POST(req: NextRequest) {
  try {
    const { question_id, participant_id, answer } = await req.json();

    if (!question_id || !participant_id || !answer) {
      return NextResponse.json(
        { error: "question_id, participant_id, and answer are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the question
    const { data: question } = await supabase
      .from("questions")
      .select("*")
      .eq("id", question_id)
      .single();

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    if (!question.is_active) {
      return NextResponse.json(
        { error: "This question is no longer active" },
        { status: 400 }
      );
    }

    // Check if already answered this question
    const { data: existingAnswer } = await supabase
      .from("answers")
      .select("id, is_correct")
      .eq("question_id", question_id)
      .eq("participant_id", participant_id)
      .single();

    if (existingAnswer?.is_correct) {
      return NextResponse.json({
        correct: true,
        already_answered: true,
        message: "You already answered this correctly!",
      });
    }

    // Normalize and compare answers
    const normalizedSubmitted = answer.trim().toUpperCase().replace(/\s+/g, " ");
    const normalizedCorrect = question.answer.trim().toUpperCase().replace(/\s+/g, " ");

    const isCorrect = normalizedSubmitted === normalizedCorrect;

    if (isCorrect) {
      // Count existing correct answers for scoring
      const { count } = await supabase
        .from("answers")
        .select("*", { count: "exact", head: true })
        .eq("question_id", question_id)
        .eq("is_correct", true);

      const rank = (count || 0) + 1;
      const points = Math.max(1, 11 - rank); // 1st: 10pts, 2nd: 9pts, ..., 10th+: 1pt

      // Upsert the answer
      if (existingAnswer) {
        await supabase
          .from("answers")
          .update({
            is_correct: true,
            points_awarded: points,
            answered_at: new Date().toISOString(),
          })
          .eq("id", existingAnswer.id);
      } else {
        await supabase.from("answers").insert({
          question_id,
          participant_id,
          is_correct: true,
          points_awarded: points,
        });
      }

      // Update participant score
      const { data: participant } = await supabase
        .from("participants")
        .select("score")
        .eq("id", participant_id)
        .single();

      await supabase
        .from("participants")
        .update({ score: (participant?.score || 0) + points })
        .eq("id", participant_id);

      return NextResponse.json({
        correct: true,
        points,
        rank,
        message: rank === 1 ? "🥇 First to answer! +10 points!" :
                 rank === 2 ? "🥈 Second place! +9 points!" :
                 rank === 3 ? "🥉 Third place! +8 points!" :
                 `+${points} points!`,
      });
    } else {
      // Generate per-letter hints (Wordle-style)
      // green = correct letter in correct position
      // yellow = correct letter but wrong position
      // gray = letter not in the answer
      const submittedLetters = normalizedSubmitted.replace(/\s/g, "").split("");
      const correctLetters = normalizedCorrect.replace(/\s/g, "").split("");

      const hints: string[] = new Array(submittedLetters.length).fill("gray");
      const correctUsed: boolean[] = new Array(correctLetters.length).fill(false);

      // First pass: mark greens (exact position match)
      for (let i = 0; i < submittedLetters.length; i++) {
        if (i < correctLetters.length && submittedLetters[i] === correctLetters[i]) {
          hints[i] = "green";
          correctUsed[i] = true;
        }
      }

      // Second pass: mark yellows (letter exists but wrong position)
      for (let i = 0; i < submittedLetters.length; i++) {
        if (hints[i] === "green") continue;
        for (let j = 0; j < correctLetters.length; j++) {
          if (!correctUsed[j] && submittedLetters[i] === correctLetters[j]) {
            hints[i] = "yellow";
            correctUsed[j] = true;
            break;
          }
        }
      }

      // Record incorrect answer (optional - don't block retries)
      if (!existingAnswer) {
        await supabase.from("answers").insert({
          question_id,
          participant_id,
          is_correct: false,
          points_awarded: 0,
        });
      }

      return NextResponse.json({
        correct: false,
        points: 0,
        letter_hints: hints,
        message: "Not quite! Check the hints and try again.",
      });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
