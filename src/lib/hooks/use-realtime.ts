"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type RealtimeEventType =
  | "message:new"
  | "message:updated"
  | "conversation:new"
  | "conversation:updated"
  | "conversation:assigned"
  | "ticket:new"
  | "ticket:updated"
  | "typing:start"
  | "typing:stop"
  | "agent:online"
  | "agent:offline"
  | "notification"
  | "connected";

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: Record<string, unknown>;
  timestamp: string;
  conversationId?: string;
}

export type RealtimeStatus = "connecting" | "connected" | "disconnected" | "error";

type EventHandler = (event: RealtimeEvent) => void;

/**
 * React hook for subscribing to Server-Sent Events (SSE).
 *
 * Uses the existing /api/realtime SSE endpoint to receive real-time
 * updates. Automatically reconnects on connection loss.
 */
export function useRealtime(
  channel = "global",
  options?: {
    onEvent?: EventHandler;
    onStatusChange?: (status: RealtimeStatus) => void;
  }
) {
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Map<RealtimeEventType, Set<EventHandler>>>(new Map());
  const genericHandlersRef = useRef<Set<EventHandler>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const updateStatus = useCallback(
    (newStatus: RealtimeStatus) => {
      setStatus(newStatus);
      options?.onStatusChange?.(newStatus);
    },
    [options]
  );

  const subscribe = useCallback(
    (eventType: RealtimeEventType, handler: EventHandler) => {
      if (!handlersRef.current.has(eventType)) {
        handlersRef.current.set(eventType, new Set());
      }
      handlersRef.current.get(eventType)!.add(handler);

      return () => {
        handlersRef.current.get(eventType)?.delete(handler);
      };
    },
    []
  );

  const onAny = useCallback((handler: EventHandler) => {
    genericHandlersRef.current.add(handler);
    return () => {
      genericHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    let closed = false;

    const connect = () => {
      if (closed) return;

      const url = new URL("/api/realtime", window.location.origin);
      url.searchParams.set("channel", channel);

      updateStatus("connecting");

      const es = new EventSource(url.toString());
      eventSourceRef.current = es;

      es.onopen = () => {
        retryCountRef.current = 0;
        updateStatus("connected");
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RealtimeEvent;
          setLastEvent(data);

          // Call type-specific handlers
          const typeHandlers = handlersRef.current.get(data.type);
          if (typeHandlers) {
            for (const handler of typeHandlers) {
              try {
                handler(data);
              } catch (err) {
                console.error("Realtime handler error:", err);
              }
            }
          }

          // Call generic handlers
          for (const handler of genericHandlersRef.current) {
            try {
              handler(data);
            } catch (err) {
              console.error("Realtime generic handler error:", err);
            }
          }

          options?.onEvent?.(data);
        } catch {
          // Ignore parse errors (heartbeats)
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        if (!closed) {
          updateStatus("error");
          retryCountRef.current++;
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      updateStatus("disconnected");
    };
  }, [channel, updateStatus, options]);

  /**
   * Send a typing indicator event via fetch (proxied server-side).
   */
  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean, userName: string) => {
      fetch("/api/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, isTyping, userName }),
        keepalive: true,
      }).catch(() => {
        // Fire-and-forget
      });
    },
    []
  );

  return {
    status,
    lastEvent,
    subscribe,
    onAny,
    sendTyping,
    isConnected: status === "connected",
  };
}

/**
 * Subscribe to a specific conversation's messages via SSE.
 */
export function useConversationRealtime(
  conversationId: string | null,
  onNewMessage?: (message: { id: string; role: string; content: string }) => void
) {
  const channel = conversationId ? `conversation:${conversationId}` : null;
  const realtime = useRealtime(channel ?? "global");

  useEffect(() => {
    if (!conversationId || !onNewMessage) return;

    const unsub = realtime.subscribe("message:new", (event) => {
      if (event.conversationId === conversationId) {
        onNewMessage(event.data as { id: string; role: string; content: string });
      }
    });

    return unsub;
  }, [conversationId, onNewMessage, realtime]);

  return realtime;
}
