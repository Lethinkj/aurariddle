"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Event, Question, Participant } from "@/lib/supabase";
import { getSupabaseBrowser } from "@/lib/supabase";

interface EventDetails {
  event: Event;
  questions: Question[];
  participants: Participant[];
}

export default function AdminEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [data, setData] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [controlling, setControlling] = useState(false);
  const [answersForCurrent, setAnswersForCurrent] = useState<
    { participant_name: string; points: number; time: string }[]
  >([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}`);
      if (res.status === 401) {
        router.push("/admin");
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      console.error("Failed to fetch event");
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscriptions for live updates
  useEffect(() => {
    if (!data?.event) return;

    const supabase = getSupabaseBrowser();

    // Subscribe to participant changes
    const participantChannel = supabase
      .channel("admin-participants")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to answer changes
    const answerChannel = supabase
      .channel("admin-answers")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "answers",
        },
        () => {
          fetchData();
          fetchCurrentAnswers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantChannel);
      supabase.removeChannel(answerChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.event?.id, data?.event?.current_question_id]);

  const fetchCurrentAnswers = async () => {
    if (!data?.event?.current_question_id) return;
    try {
      const res = await fetch(
        `/api/admin/events/${eventId}?answers_for=${data.event.current_question_id}`
      );
      if (res.ok) {
        const json = await res.json();
        setAnswersForCurrent(json.current_answers || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (data?.event?.current_question_id) {
      fetchCurrentAnswers();
    } else {
      setAnswersForCurrent([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.event?.current_question_id]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !answerText.trim()) return;
    setAddingQuestion(true);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: questionText.trim(),
          answer: answerText.trim().toUpperCase(),
        }),
      });

      if (res.ok) {
        setQuestionText("");
        setAnswerText("");
        fetchData();
      }
    } catch {
      console.error("Failed to add question");
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await fetch(`/api/admin/events/${eventId}/questions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId }),
      });
      fetchData();
    } catch {
      console.error("Failed to delete question");
    }
  };

  const handleControl = async (action: string) => {
    setControlling(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      console.error("Failed to control event");
    } finally {
      setControlling(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading event...</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-gray-400">Event not found</div>
          <Link href="/admin/dashboard" className="btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { event, questions, participants } = data;
  const currentQuestion = questions.find((q) => q.id === event.current_question_id);
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gold-400 transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">{event.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono bg-gold-500/20 text-gold-300 px-3 py-1 rounded-lg text-lg font-bold">
              {event.code}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full border ${
              event.status === "active"
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : event.status === "completed"
                ? "bg-gold-500/20 text-gold-400 border-gold-500/30"
                : "bg-gray-500/20 text-gray-400 border-gray-500/30"
            }`}>
              {event.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2 flex-wrap">
          {event.status === "draft" && questions.length > 0 && (
            <button
              onClick={() => handleControl("start")}
              disabled={controlling}
              className="btn-success"
            >
              ▶ Start Event
            </button>
          )}
          {event.status === "active" && (
            <>
              <button
                onClick={() => handleControl("next_question")}
                disabled={controlling}
                className="btn-primary"
              >
                {event.current_question_id ? "→ Next Question" : "→ Show First Question"}
              </button>
              <button
                onClick={() => handleControl("end")}
                disabled={controlling}
                className="btn-danger"
              >
                ⬛ End Event
              </button>
            </>
          )}
          {event.status === "completed" && (
            <button
              onClick={() => handleControl("reactivate")}
              disabled={controlling}
              className="px-6 py-3 bg-blue-600/80 text-white font-semibold rounded-xl hover:bg-blue-500/80 transition-all duration-200"
            >
              ↻ Reactivate Event
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Questions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Completed event banner */}
          {event.status === "completed" && (
            <div className="glass-card p-6 border-gold-500/30 text-center space-y-2">
              <div className="text-4xl">🏆</div>
              <h3 className="text-xl font-bold text-gold-300">Event Completed</h3>
              <p className="text-sm text-gray-400">
                This event has ended. You can review all questions and the leaderboard below.
              </p>
            </div>
          )}

          {/* Current Question Display */}
          {event.status === "active" && currentQuestion && (
            <div className="glass-card p-6 border-gold-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gold-400 uppercase tracking-wider">
                  Current Question ({currentQuestion.question_order + 1} / {questions.length})
                </h3>
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
              <p className="text-xl font-bold text-white">{currentQuestion.question_text}</p>
              <p className="text-sm text-gray-400">
                Answer: <span className="font-mono text-green-400">{currentQuestion.answer}</span>
              </p>

              {/* Who answered */}
              {answersForCurrent.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm text-gray-400">Correct Answers:</h4>
                  {answersForCurrent.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2"
                    >
                      <span className="text-green-400 font-semibold">
                        #{i + 1} {a.participant_name}
                      </span>
                      <span className="text-green-300 text-sm">+{a.points} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {event.status === "active" && !currentQuestion && (
            <div className="glass-card p-6 text-center">
              <p className="text-gray-400">
                Event is active. Click &quot;Show First Question&quot; to begin!
              </p>
            </div>
          )}

          {/* Questions List */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-300">
              Questions ({questions.length})
            </h2>

            {/* Add Question Form (only in draft) */}
            {event.status === "draft" && (
              <form onSubmit={handleAddQuestion} className="glass-card p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Question / Clue</label>
                  <input
                    type="text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="input-field"
                    placeholder="e.g. Capital of France"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Answer (word to guess)</label>
                  <input
                    type="text"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value.toUpperCase())}
                    className="input-field font-mono uppercase"
                    placeholder="e.g. PARIS"
                    required
                  />
                  {answerText && (
                    <p className="text-xs text-gray-500">
                      Players will see {answerText.split(" ").map((w) => `[${w.length} letters]`).join(" ")} boxes
                    </p>
                  )}
                </div>
                <button type="submit" disabled={addingQuestion} className="btn-primary">
                  {addingQuestion ? "Adding..." : "+ Add Question"}
                </button>
              </form>
            )}

            {/* Questions */}
            {questions.length === 0 ? (
              <div className="glass-card p-8 text-center text-gray-500">
                No questions yet. Add your first question above!
              </div>
            ) : (
              <div className="space-y-2">
                {questions
                  .sort((a, b) => a.question_order - b.question_order)
                  .map((q, index) => (
                    <div
                      key={q.id}
                      className={`glass-card p-4 flex items-center justify-between gap-4 ${
                        q.id === event.current_question_id
                          ? "border-gold-500/50 bg-gold-500/5"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-sm text-gray-500 font-mono w-6">
                          {index + 1}.
                        </span>
                        <div className="min-w-0">
                          <p className="text-white truncate">{q.question_text}</p>
                          <p className="text-sm text-gray-500 font-mono">{q.answer}</p>
                        </div>
                      </div>
                      {event.status === "draft" && (
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          ✕
                        </button>
                      )}
                      {q.id === event.current_question_id && (
                        <span className="text-xs bg-gold-500/30 text-gold-300 px-2 py-1 rounded">
                          LIVE
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Participants & Leaderboard */}
        <div className="space-y-6">
          {/* Leaderboard */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-300">
                {event.status === "completed" ? "🏆 Leaderboard" : `Players (${participants.length})`}
              </h2>
              {event.status === "completed" && participants.length > 0 && (
                <span className="text-xs text-gray-500">{participants.length} players</span>
              )}
            </div>

            {participants.length === 0 ? (
              <p className="text-sm text-gray-500">
                No players yet. Share the code{" "}
                <span className="font-mono text-gold-300">{event.code}</span>{" "}
                for players to join!
              </p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {sortedParticipants.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                      event.status === "completed" && i < 3
                        ? i === 0
                          ? "bg-yellow-500/10 border border-yellow-500/30"
                          : i === 1
                          ? "bg-gray-400/10 border border-gray-400/20"
                          : "bg-amber-700/10 border border-amber-700/20"
                        : "bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-bold w-8 text-center ${
                          i === 0
                            ? "text-yellow-400 text-lg"
                            : i === 1
                            ? "text-gray-300"
                            : i === 2
                            ? "text-amber-600"
                            : "text-gray-500"
                        }`}
                      >
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      <span className={`font-semibold ${i < 3 && event.status === "completed" ? "text-white text-base" : "text-white"}`}>
                        {p.name}
                      </span>
                    </div>
                    <span className={`font-mono font-bold ${
                      i === 0 && event.status === "completed"
                        ? "text-yellow-400 text-lg"
                        : "text-gold-300"
                    }`}>
                      {p.score} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Stats for completed */}
          {event.status === "completed" && participants.length > 0 && (
            <div className="glass-card p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Event Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gold-300">{questions.length}</p>
                  <p className="text-xs text-gray-500">Questions</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gold-300">{participants.length}</p>
                  <p className="text-xs text-gray-500">Players</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">
                    {sortedParticipants.length > 0 ? sortedParticipants[0].score : 0}
                  </p>
                  <p className="text-xs text-gray-500">Top Score</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    {participants.length > 0
                      ? Math.round(participants.reduce((sum, p) => sum + p.score, 0) / participants.length)
                      : 0}
                  </p>
                  <p className="text-xs text-gray-500">Avg Score</p>
                </div>
              </div>
            </div>
          )}

          {/* Share Info */}
          <div className="glass-card p-6 space-y-3">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Share with Players
            </h3>
            <div className="text-center">
              <p className="text-4xl font-black font-mono text-gold-300 tracking-widest">
                {event.code}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Players enter this code to join
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
