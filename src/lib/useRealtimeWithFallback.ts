"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * A single broadcast subscription: event name → handler.
 */
export interface BroadcastSubscription {
  event: string;
  handler: (payload?: unknown) => void;
}

interface UseRealtimeOptions {
  /** Supabase channel name suffix (e.g. eventId) */
  eventId: string;
  /** Broadcast event subscriptions */
  subscriptions: BroadcastSubscription[];
  /**
   * Functions to call periodically when polling.
   * Typically these are the same fetch functions invoked inside broadcast handlers.
   */
  pollingCallbacks: (() => void)[];
  /** Polling interval in ms (default 3 000) */
  pollingInterval?: number;
  /** Set to false to disable everything (e.g. before data is ready) */
  enabled?: boolean;
}

/**
 * Attempts a Supabase Realtime (WebSocket) connection.
 * If the connection fails or drops, it automatically falls back to
 * periodic HTTP polling using the provided callbacks, so users whose
 * network blocks WSS still get live-ish updates.
 *
 * When the WebSocket reconnects the polling stops automatically.
 */
export function useRealtimeWithFallback({
  eventId,
  subscriptions,
  pollingCallbacks,
  pollingInterval = 3000,
  enabled = true,
}: UseRealtimeOptions) {
  const [mode, setMode] = useState<"realtime" | "polling" | "connecting">(
    "connecting"
  );

  // Keep mutable refs so the latest callbacks are always used
  const subsRef = useRef(subscriptions);
  subsRef.current = subscriptions;

  const pollCbRef = useRef(pollingCallbacks);
  pollCbRef.current = pollingCallbacks;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- helpers ---- */

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    setMode("polling");

    // Immediately invoke once, then repeat
    pollCbRef.current.forEach((fn) => {
      try {
        fn();
      } catch {
        /* swallow */
      }
    });

    pollingTimerRef.current = setInterval(() => {
      pollCbRef.current.forEach((fn) => {
        try {
          fn();
        } catch {
          /* swallow */
        }
      });
    }, pollingInterval);
  }, [pollingInterval, stopPolling]);

  /* ---- main effect ---- */

  useEffect(() => {
    if (!enabled || !eventId) return;

    const supabase = getSupabaseBrowser();
    let mounted = true;

    // Build channel with all broadcast listeners
    let channel = supabase.channel(`event:${eventId}`);

    for (const sub of subsRef.current) {
      const { event, handler } = sub;
      channel = channel.on("broadcast", { event }, (payload) => {
        handler(payload);
      });
    }

    channelRef.current = channel;

    // Subscribe and watch for connection status
    channel.subscribe((status) => {
      if (!mounted) return;

      if (status === "SUBSCRIBED") {
        // WebSocket connected — stop any fallback polling
        stopPolling();
        setMode("realtime");
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      } else if (
        status === "CLOSED" ||
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        // Connection lost or failed — fall back to polling
        startPolling();
      }
    });

    // Safety net: if we haven't connected within 5 s, start polling
    retryTimerRef.current = setTimeout(() => {
      if (mounted && mode === "connecting") {
        startPolling();
      }
    }, 5000);

    return () => {
      mounted = false;
      stopPolling();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Re-run when eventId or enabled changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, enabled]);

  return { mode };
}
