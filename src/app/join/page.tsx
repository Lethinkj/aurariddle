"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinPage() {
  const router = useRouter();
  const [eventCode, setEventCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_code: eventCode.trim().toUpperCase(),
          name: name.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Store participant info in localStorage
        localStorage.setItem(
          `aurariddle_participant_${data.event_id}`,
          JSON.stringify({
            participant_id: data.participant_id,
            name: name.trim(),
            event_id: data.event_id,
            event_name: data.event_name,
          })
        );

        router.push(`/play/${data.event_id}`);
      } else {
        setError(data.error || "Failed to join");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="text-3xl font-black gradient-text">
            AuraRiddle
          </Link>
          <h2 className="text-xl text-gray-300">Join an Event</h2>
        </div>

        <form onSubmit={handleJoin} className="glass-card p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Event Code</label>
            <input
              type="text"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value.toUpperCase())}
              className="input-field text-center text-2xl font-mono tracking-widest uppercase"
              placeholder="ABC123"
              maxLength={6}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Enter your name"
              maxLength={30}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full text-lg">
            {loading ? "Joining..." : "🎮 Join Game"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-gold-400 transition-colors">
            ← Back to Home
          </Link>
        </p>
      </div>
    </main>
  );
}
