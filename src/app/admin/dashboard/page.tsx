"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Event } from "@/lib/supabase";

export default function AdminDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/events");
      if (res.status === 401) {
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      console.error("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEventName.trim() }),
      });

      if (res.ok) {
        setNewEventName("");
        setShowCreate(false);
        fetchEvents();
      }
    } catch {
      console.error("Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin");
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      active: "bg-green-500/20 text-green-400 border-green-500/30",
      completed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full border ${styles[status] || styles.draft}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/" className="text-2xl font-black gradient-text">
            HardWord
          </Link>
          <p className="text-sm text-gray-400 mt-1">Admin Dashboard</p>
        </div>
        <button onClick={handleLogout} className="btn-secondary text-sm">
          Logout
        </button>
      </div>

      {/* Create Event */}
      <div className="mb-8">
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Create New Event
          </button>
        ) : (
          <form onSubmit={handleCreateEvent} className="glass-card p-6 flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm text-gray-400">Event Name</label>
              <input
                type="text"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                className="input-field"
                placeholder="e.g. Friday Quiz Night"
                required
                autoFocus
              />
            </div>
            <button type="submit" disabled={creating} className="btn-primary whitespace-nowrap">
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewEventName(""); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Events List */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-4">
          <div className="text-5xl">📋</div>
          <h3 className="text-xl font-bold text-gray-300">No Events Yet</h3>
          <p className="text-gray-500">Create your first event to get started!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/admin/event/${event.id}`}
              className="glass-card p-6 hover:bg-white/10 transition-all duration-200 block"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">{event.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-purple-300">
                      {event.code}
                    </span>
                    <span>
                      {new Date(event.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(event.status)}
                  <span className="text-gray-500">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
