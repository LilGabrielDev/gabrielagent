"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Server,
  Database,
  Bot,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthResponse {
  status: string;
  services: Record<string, string>;
  uptime?: string;
}

interface WhatsAppStatus {
  status: string;
  message?: string;
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gabriel-text-light">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium",
          ok ? "text-gabriel-success" : "text-gabriel-danger"
        )}
      >
        {ok ? (
          <CheckCircle className="h-3.5 w-3.5" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5" />
        )}
        {value}
      </span>
    </div>
  );
}

export function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, waRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/channels/whatsapp").catch(() => null),
      ]);

      if (healthRes.ok) {
        setHealth(await healthRes.json());
      } else {
        setError("Health check failed");
      }

      if (waRes?.ok) {
        setWhatsapp(await waRes.json());
      } else {
        setWhatsapp({ status: "unconfigured", message: "Service not reachable" });
      }
    } catch {
      setError("Could not load system status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  const dbOk = health?.services?.database === "connected";
  const aiOk =
    health?.services?.openai === "reachable" ||
    health?.services?.openai === "not_configured";
  const waOk = whatsapp?.status === "connected";

  return (
    <div className="bg-gabriel-surface rounded-xl border border-gabriel-border overflow-hidden">
      <div className="px-5 py-4 border-b border-gabriel-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-gabriel-primary" />
          <h3 className="font-semibold text-gabriel-text">System Status</h3>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="p-1.5 text-gabriel-text-light hover:text-gabriel-text rounded-lg hover:bg-gabriel-bg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>
      <div className="p-5 space-y-3">
        {loading && !health ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gabriel-primary" />
          </div>
        ) : error ? (
          <p className="text-sm text-gabriel-danger">{error}</p>
        ) : (
          <>
            <StatusRow
              label="Application"
              value={health?.status === "ok" ? "Healthy" : "Degraded"}
              ok={health?.status === "ok"}
            />
            <StatusRow
              label="Database"
              value={dbOk ? "Connected" : "Error"}
              ok={!!dbOk}
            />
            <StatusRow
              label="AI Provider"
              value={
                health?.services?.openai === "not_configured"
                  ? "Not configured"
                  : health?.services?.openai === "reachable"
                    ? "Reachable"
                    : "Unavailable"
              }
              ok={!!aiOk}
            />
            <StatusRow
              label="WhatsApp"
              value={
                whatsapp?.status === "connected"
                  ? "Connected"
                  : whatsapp?.status === "unconfigured"
                    ? "Not configured"
                    : whatsapp?.status || "Disconnected"
              }
              ok={waOk}
            />
            {health?.uptime && (
              <p className="text-xs text-gabriel-text-light pt-1 border-t border-gabriel-border">
                Uptime: {health.uptime}
              </p>
            )}
          </>
        )}
      </div>
      <div className="px-5 py-3 bg-gabriel-bg/50 border-t border-gabriel-border flex gap-3">
        <Link
          href="/channels"
          className="text-xs font-medium text-gabriel-primary hover:underline inline-flex items-center gap-1"
        >
          <MessageCircle className="h-3 w-3" />
          Channels
        </Link>
        <Link
          href="/settings"
          className="text-xs font-medium text-gabriel-primary hover:underline inline-flex items-center gap-1"
        >
          <Bot className="h-3 w-3" />
          AI Settings
        </Link>
        <Link
          href="/api/health"
          target="_blank"
          className="text-xs font-medium text-gabriel-text-light hover:text-gabriel-text inline-flex items-center gap-1 ml-auto"
        >
          <Database className="h-3 w-3" />
          Raw health
        </Link>
      </div>
    </div>
  );
}
