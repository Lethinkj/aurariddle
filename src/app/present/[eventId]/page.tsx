"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  total_time_ms: number | null;
}

interface WrongAnswerToast {
  id: number;
  participant_name: string;
  wrong_answer: string;
}

interface CurrentQuestion {
  id: string;
  question_text: string;
  answer_pattern: number[];
  question_order: number;
  total_questions: number;
}

export default function PresentationPage() {
  const params = useParams();
  const eventId = params.eventId as string;

  const [eventName, setEventName] = useState("");
  const [eventStatus, setEventStatus] = useState("draft");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswerToast[]>([]);
  const toastIdRef = useRef(0);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${eventId}/leaderboard`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch {
      // ignore
    }
  }, [eventId]);

  // Fetch current question & event info
  const fetchCurrentQuestion = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${eventId}/current`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setEventName(data.event_name || "");
      setEventStatus(data.event_status || "draft");
      setCurrentQuestion(data.current_question || null);
    } catch {
      // ignore
    }
  }, [eventId]);

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
    fetchCurrentQuestion();
  }, [fetchLeaderboard, fetchCurrentQuestion]);

  // Realtime subscriptions
  useEffect(() => {
    const supabase = getSupabaseBrowser();

    const channel = supabase
      .channel(`event:${eventId}`)
      .on("broadcast", { event: "event-update" }, () => {
        fetchCurrentQuestion();
        fetchLeaderboard();
      })
      .on("broadcast", { event: "leaderboard-update" }, () => {
        fetchLeaderboard();
      })
      .on("broadcast", { event: "participant-joined" }, () => {
        fetchLeaderboard();
      })
      .on("broadcast", { event: "answer-submitted" }, () => {
        fetchLeaderboard();
      })
      .on("broadcast", { event: "wrong-answer" }, (payload) => {
        const data = payload.payload as {
          participant_name: string;
          wrong_answer: string;
        };
        const id = ++toastIdRef.current;
        const toast: WrongAnswerToast = {
          id,
          participant_name: data.participant_name,
          wrong_answer: data.wrong_answer,
        };
        setWrongAnswers((prev) => [...prev, toast]);

        // Remove after 5 seconds
        setTimeout(() => {
          setWrongAnswers((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchCurrentQuestion, fetchLeaderboard]);

  const getRankStyle = (index: number) => {
    if (index === 0) return "text-yellow-400";
    if (index === 1) return "text-gray-300";
    if (index === 2) return "text-amber-600";
    return "text-neutral-400";
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `${index + 1}`;
  };

  const formatTime = (ms: number | null) => {
    if (ms == null) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-x-hidden">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gold-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[200px] bg-gold-500/3 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-8 py-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold gradient-text tracking-tight">
              {eventName || "HardWord"}
            </h1>
            <p className="text-neutral-500 text-sm mt-1">Live Presentation</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                eventStatus === "active"
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : eventStatus === "completed"
                  ? "bg-neutral-500/20 text-neutral-400 border border-neutral-500/30"
                  : "bg-gold-500/20 text-gold-400 border border-gold-500/30"
              }`}
            >
              {eventStatus}
            </span>
            <span className="text-neutral-600 text-sm">
              {leaderboard.length} player{leaderboard.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row gap-8 p-8 max-w-7xl mx-auto w-full min-h-0">
        {/* Current Question Panel */}
        <div className="lg:w-1/2 flex flex-col">
          {currentQuestion ? (
            <div className="glass-card p-8 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <span className="text-gold-400 text-sm font-semibold uppercase tracking-wider">
                  Question {currentQuestion.question_order + 1} of{" "}
                  {currentQuestion.total_questions}
                </span>
                <div className="h-1 flex-1 mx-4 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gold-600 to-gold-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        ((currentQuestion.question_order + 1) /
                          currentQuestion.total_questions) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-8">
                {currentQuestion.question_text}
              </h2>

              {/* Answer pattern display */}
              <div className="flex flex-wrap gap-3 mt-auto">
                {currentQuestion.answer_pattern.map((wordLen, wordIdx) => (
                  <div key={wordIdx} className="flex gap-1">
                    {Array.from({ length: wordLen }).map((_, letterIdx) => (
                      <div
                        key={letterIdx}
                        className="w-10 h-12 lg:w-12 lg:h-14 border-2 border-neutral-700 rounded-lg bg-neutral-900/80 flex items-center justify-center"
                      >
                        <span className="text-neutral-600 text-lg">?</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card p-8 flex-1 flex flex-col items-center justify-center text-center">
              {eventStatus === "completed" ? (
                <>
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-3xl font-bold gradient-text mb-2">
                    Game Over!
                  </h2>
                  <p className="text-neutral-400 text-lg">
                    Final standings are shown on the leaderboard
                  </p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4 animate-pulse-slow">⏳</div>
                  <h2 className="text-2xl font-bold text-neutral-300 mb-2">
                    Waiting for the next question...
                  </h2>
                  <p className="text-neutral-500">
                    The host will reveal the next question shortly
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Leaderboard Panel */}
        <div className="lg:w-1/2">
          <div className="glass-card p-6 h-full flex flex-col">
            <h2 className="text-xl font-bold text-gold-400 mb-4 flex items-center gap-2">
              <span className="text-2xl">🏆</span> Leaderboard
            </h2>

            {leaderboard.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-neutral-500">
                No players yet
              </div>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                      index === 0
                        ? "bg-yellow-500/10 border border-yellow-500/20"
                        : index === 1
                        ? "bg-gray-400/10 border border-gray-400/15"
                        : index === 2
                        ? "bg-amber-700/10 border border-amber-700/15"
                        : "bg-white/[0.02] border border-white/5"
                    }`}
                  >
                    {/* Rank */}
                    <div
                      className={`text-2xl font-bold w-10 text-center ${getRankStyle(
                        index
                      )}`}
                    >
                      {getRankIcon(index)}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-lg font-semibold truncate block ${
                          index < 3 ? "text-white" : "text-neutral-300"
                        }`}
                      >
                        {entry.name}
                      </span>
                      {entry.total_time_ms != null && (
                        <span className="text-xs text-neutral-500">
                          ⏱ {formatTime(entry.total_time_ms)}
                        </span>
                      )}
                    </div>

                    {/* Score */}
                    <div
                      className={`text-2xl font-bold tabular-nums ${getRankStyle(
                        index
                      )}`}
                    >
                      {entry.score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Wrong Answer Toasts */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 pointer-events-none">
        {wrongAnswers.map((toast) => (
          <div
            key={toast.id}
            className="animate-slide-up bg-red-500/20 border border-red-500/40 backdrop-blur-md rounded-2xl px-8 py-4 shadow-2xl shadow-red-500/10"
          >
            <p className="text-lg text-center">
              <span className="font-bold text-red-300">
                {toast.participant_name}
              </span>{" "}
              <span className="text-neutral-300">thinks</span>{" "}
              <span className="font-bold text-white uppercase tracking-wide">
                {toast.wrong_answer}
              </span>{" "}
              <span className="text-neutral-300">is the answer</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
