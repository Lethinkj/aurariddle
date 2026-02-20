"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSupabaseBrowser, type QuestionPublic } from "@/lib/supabase";

interface ParticipantInfo {
  participant_id: string;
  name: string;
  event_id: string;
  event_name: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [eventStatus, setEventStatus] = useState<string>("draft");
  const [eventName, setEventName] = useState<string>("");
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPublic | null>(null);
  const [prevQuestionId, setPrevQuestionId] = useState<string | null>(null);
  const [letters, setLetters] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "correct" | "incorrect" | null;
    message: string;
  }>({ type: null, message: "" });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [letterHints, setLetterHints] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leaderboardPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load participant info from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`aurariddle_participant_${eventId}`);
    if (stored) {
      try {
        setParticipant(JSON.parse(stored));
      } catch {
        router.push("/join");
      }
    } else {
      router.push("/join");
    }
  }, [eventId, router]);

  // Fetch current question
  const fetchCurrentQuestion = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${eventId}/current`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();

      setEventStatus(data.event_status);
      setEventName(data.event_name || "");

      if (data.current_question) {
        const q = data.current_question as QuestionPublic;

        // Only reset if it's a new question
        if (q.id !== prevQuestionId) {
          setCurrentQuestion(q);
          setPrevQuestionId(q.id);
          const totalLetters = q.answer_pattern.reduce((a: number, b: number) => a + b, 0);
          setLetters(new Array(totalLetters).fill(""));
          setFeedback({ type: null, message: "" });
          setAnswered(false);
          setLetterHints([]);

          // Focus first input after a short delay
          setTimeout(() => {
            inputRefs.current[0]?.focus();
          }, 100);
        }
      } else {
        if (currentQuestion !== null) {
          setCurrentQuestion(null);
        }
      }
    } catch {
      // Network error, will retry
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, prevQuestionId]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${eventId}/leaderboard`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch {
      // ignore
    }
  }, [eventId]);

  // Real-time subscription for event changes
  useEffect(() => {
    if (!participant) return;

    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel(`play-event-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        () => {
          // Event updated - fetch new state
          fetchCurrentQuestion();
          fetchLeaderboard();
        }
      )
      .subscribe();

    // Also subscribe to participant updates for leaderboard
    const leaderboardChannel = supabase
      .channel(`play-leaderboard-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(leaderboardChannel);
    };
  }, [participant, eventId, fetchCurrentQuestion, fetchLeaderboard]);

  // Polling fallback (in case realtime doesn't fire)
  useEffect(() => {
    if (!participant) return;

    fetchCurrentQuestion();
    fetchLeaderboard();

    pollRef.current = setInterval(fetchCurrentQuestion, 8000);
    leaderboardPollRef.current = setInterval(fetchLeaderboard, 12000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (leaderboardPollRef.current) clearInterval(leaderboardPollRef.current);
    };
  }, [participant, fetchCurrentQuestion, fetchLeaderboard]);

  // Handle letter input
  const handleLetterChange = (index: number, value: string) => {
    if (answered) return;

    const char = value.slice(-1).toUpperCase();
    if (char && !/^[A-Z]$/.test(char)) return;

    const newLetters = [...letters];
    newLetters[index] = char;
    setLetters(newLetters);

    // Clear feedback on new input
    if (feedback.type === "incorrect") {
      setFeedback({ type: null, message: "" });
      setLetterHints([]);
    }

    // Auto-advance to next input
    if (char && index < letters.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (answered) return;

    if (e.key === "Backspace" && !letters[index] && index > 0) {
      const newLetters = [...letters];
      newLetters[index - 1] = "";
      setLetters(newLetters);
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < letters.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  // Submit answer
  const handleSubmit = async () => {
    if (!currentQuestion || !participant || submitting || answered) return;

    // Check all letters are filled
    if (letters.some((l) => !l)) {
      setFeedback({ type: "incorrect", message: "Fill in all the letters!" });
      return;
    }

    setSubmitting(true);

    // Reconstruct the answer with spaces
    const pattern = currentQuestion.answer_pattern;
    let answerStr = "";
    let letterIndex = 0;
    for (let w = 0; w < pattern.length; w++) {
      if (w > 0) answerStr += " ";
      for (let i = 0; i < pattern[w]; i++) {
        answerStr += letters[letterIndex++];
      }
    }

    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          participant_id: participant.participant_id,
          answer: answerStr,
        }),
      });

      const data = await res.json();

      if (data.correct) {
        setFeedback({ type: "correct", message: data.message });
        setAnswered(true);
        setLetterHints([]);
        fetchLeaderboard();
      } else {
        setFeedback({ type: "incorrect", message: data.message });
        // Show per-letter hints (green/yellow/gray)
        if (data.letter_hints) {
          setLetterHints(data.letter_hints);
        }
        // Don't clear letters — let user see hints and correct their answer
      }
    } catch {
      setFeedback({ type: "incorrect", message: "Network error. Try again!" });
    } finally {
      setSubmitting(false);
    }
  };

  // Render letter boxes with word grouping
  const renderLetterBoxes = () => {
    if (!currentQuestion) return null;

    const pattern = currentQuestion.answer_pattern;
    let globalIndex = 0;
    const words: React.ReactNode[] = [];

    for (let w = 0; w < pattern.length; w++) {
      const boxes: React.ReactNode[] = [];
      for (let i = 0; i < pattern[w]; i++) {
        const idx = globalIndex;
        const hintClass = letterHints[idx]
          ? `hint-${letterHints[idx]}`
          : "";
        boxes.push(
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            maxLength={1}
            value={letters[idx] || ""}
            onChange={(e) => handleLetterChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            disabled={answered || submitting}
            className={`letter-box ${letters[idx] ? "filled" : ""} ${
              feedback.type === "correct" ? "correct" : ""
            } ${hintClass}`}
            autoComplete="off"
            autoCapitalize="characters"
          />
        );
        globalIndex++;
      }
      words.push(
        <div key={`word-${w}`} className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 justify-center">
          {boxes}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-3 sm:gap-4 md:gap-6 justify-center items-center">
        {words}
      </div>
    );
  };

  // Not loaded yet
  if (!participant) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    );
  }

  const myScore = leaderboard.find((l) => l.id === participant.participant_id)?.score || 0;
  const myRank =
    leaderboard.findIndex((l) => l.id === participant.participant_id) + 1 || "-";

  return (
    <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="AuraRiddle" width={36} height={36} className="rounded-lg" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold gradient-text">
              {eventName || "AuraRiddle"}
            </h1>
            <p className="text-sm text-gray-400">
              Playing as <span className="text-gold-300 font-semibold">{participant.name}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-gold-300">{myScore}</div>
          <div className="text-xs text-gray-500">Rank #{myRank}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Game Area */}
        <div className="lg:col-span-2">
          {/* Waiting for event to start */}
          {eventStatus === "draft" && (
            <div className="glass-card p-12 text-center space-y-4 animate-pulse-slow">
              <div className="text-5xl">⏳</div>
              <h2 className="text-xl font-bold text-gray-300">
                Waiting for host to start...
              </h2>
              <p className="text-gray-500">The game will begin soon. Stay on this page!</p>
            </div>
          )}

          {/* Event is active */}
          {eventStatus === "active" && !currentQuestion && (
            <div className="glass-card p-12 text-center space-y-4 animate-pulse-slow">
              <div className="text-5xl">⏳</div>
              <h2 className="text-xl font-bold text-gray-300">
                Waiting for the next question...
              </h2>
              <p className="text-gray-500">Get ready!</p>
            </div>
          )}

          {/* Question Active */}
          {eventStatus === "active" && currentQuestion && (
            <div className="space-y-6 animate-slide-up">
              {/* Question Header */}
              <div className="glass-card p-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">
                    Question {currentQuestion.question_order + 1} of{" "}
                    {currentQuestion.total_questions}
                  </span>
                  {!answered && (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {currentQuestion.question_text}
                </h2>
                <p className="text-sm text-gray-500">
                  {currentQuestion.answer_pattern.length > 1
                    ? `${currentQuestion.answer_pattern.length} words: ${currentQuestion.answer_pattern
                        .map((l) => `${l} letters`)
                        .join(", ")}`
                    : `${currentQuestion.answer_pattern[0]} letters`}
                </p>
              </div>

              {/* Letter Boxes */}
              <div className="glass-card p-6 sm:p-8">
                {renderLetterBoxes()}

                {/* Hint Legend */}
                {letterHints.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-green-600 inline-block" /> Correct spot
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-yellow-600 inline-block" /> Wrong spot
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-neutral-700 inline-block" /> Not in word
                    </span>
                  </div>
                )}

                {/* Feedback */}
                {feedback.type && (
                  <div
                    className={`mt-6 p-4 rounded-lg text-center font-bold text-lg ${
                      feedback.type === "correct"
                        ? "bg-green-500/10 border border-green-500/30 text-green-400"
                        : "bg-red-500/10 border border-red-500/30 text-red-400"
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                {/* Submit Button */}
                {!answered && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || letters.some((l) => !l)}
                      className="btn-primary text-lg px-10"
                    >
                      {submitting ? "Checking..." : "Submit Answer"}
                    </button>
                  </div>
                )}

                {answered && (
                  <div className="mt-6 text-center text-gray-400">
                    ✅ Waiting for next question...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event Completed */}
          {eventStatus === "completed" && (
            <div className="glass-card p-12 text-center space-y-6">
              <div className="text-5xl">🏆</div>
              <h2 className="text-2xl font-bold text-white">Game Over!</h2>
              <div className="space-y-2">
                <p className="text-4xl font-black text-gold-300">{myScore} points</p>
                <p className="text-gray-400">
                  Final Rank: <span className="text-white font-bold">#{myRank}</span>
                </p>
              </div>
              <Link href="/" className="btn-secondary inline-block">
                Back to Home
              </Link>
            </div>
          )}
        </div>

        {/* Leaderboard Sidebar */}
        <div className="glass-card p-6 space-y-4 h-fit">
          <h3 className="text-lg font-bold text-gray-300 flex items-center gap-2">
            🏆 Leaderboard
          </h3>

          {leaderboard.length === 0 ? (
            <p className="text-sm text-gray-500">No players yet</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 20).map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    entry.id === participant.participant_id
                      ? "bg-gold-500/20 border border-gold-500/30"
                      : "bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold w-6 ${
                        i === 0
                          ? "text-yellow-400"
                          : i === 1
                          ? "text-gray-300"
                          : i === 2
                          ? "text-amber-600"
                          : "text-gray-500"
                      }`}
                    >
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <span
                      className={`text-sm ${
                        entry.id === participant.participant_id
                          ? "text-gold-300 font-bold"
                          : "text-white"
                      }`}
                    >
                      {entry.name}
                      {entry.id === participant.participant_id && " (you)"}
                    </span>
                  </div>
                  <span className="text-sm font-mono font-bold text-gold-300">
                    {entry.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
