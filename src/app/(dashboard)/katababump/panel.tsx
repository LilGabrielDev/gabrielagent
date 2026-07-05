"use client";

import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  CheckCircle,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  MonitorCog,
  QrCode,
  RefreshCw,
  Server,
  Terminal,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type WhatsAppStatus = {
  status: "disconnected" | "qr_ready" | "connecting" | "connected" | "error" | "unsupported";
  qr: string | null;
  message?: string;
};

const workerExample = `import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth/katababump" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => qrcode.generate(qr, { small: true }));
client.on("ready", () => console.log("Katababump WhatsApp is ready"));
client.initialize();`;

const vercelBridgeExample = `# Recommended deployment shape
# 1. Keep this Vercel dashboard as the visible control panel.
# 2. Run whatsapp-web.js on a long-running Node server.
# 3. Point this app at that worker through env vars/webhooks.

KATABABUMP_WHATSAPP_WORKER_URL=https://your-worker.example.com
WEBHOOK_SECRET=change-me`;

function statusTone(status: WhatsAppStatus["status"]) {
  if (status === "connected") return "text-owly-success bg-owly-success/10 border-owly-success/20";
  if (status === "qr_ready" || status === "connecting") return "text-amber-700 bg-amber-50 border-amber-200";
  if (status === "unsupported" || status === "error") return "text-owly-danger bg-owly-danger/10 border-owly-danger/20";
  return "text-owly-text-light bg-owly-bg border-owly-border";
}

function statusLabel(status: WhatsAppStatus["status"]) {
  return status.replace("_", " ");
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="border border-owly-border rounded-lg overflow-hidden bg-owly-surface">
      <div className="flex items-center justify-between px-4 py-3 border-b border-owly-border">
        <div className="flex items-center gap-2 text-sm font-medium text-owly-text">
          <Code2 className="h-4 w-4 text-owly-primary" />
          {title}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-owly-border text-owly-text-light hover:text-owly-text hover:bg-owly-primary-50 transition-colors"
        >
          {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs leading-5 text-owly-text bg-owly-bg">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function KatababumpWhatsAppPanel() {
  const [status, setStatus] = useState<WhatsAppStatus>({
    status: "disconnected",
    qr: null,
    message: "Not checked yet",
  });
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"connect" | "disconnect" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/channels/whatsapp", { cache: "no-store" });
      const data = await response.json();
      setStatus({
        status: data.status ?? "error",
        qr: data.qr ?? null,
        message: data.message ?? "Status loaded",
      });
    } catch {
      setStatus({
        status: "error",
        qr: null,
        message: "Could not reach the WhatsApp status endpoint",
      });
      showToast("Could not load WhatsApp status", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!["connecting", "qr_ready"].includes(status.status)) return;
    const timer = window.setInterval(refreshStatus, 3000);
    return () => window.clearInterval(timer);
  }, [refreshStatus, status.status]);

  const runAction = async (action: "connect" | "disconnect") => {
    setBusyAction(action);
    try {
      const response = await fetch("/api/channels/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      setStatus({
        status: data.status ?? (response.ok ? "connecting" : "error"),
        qr: data.qr ?? null,
        message: data.message ?? (response.ok ? "Action sent" : "Action failed"),
      });
      showToast(response.ok ? "WhatsApp action sent" : data.message ?? "Action failed", response.ok ? "success" : "error");
    } catch {
      showToast("WhatsApp action failed", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const statusIcon = useMemo(() => {
    if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (status.status === "connected") return <Wifi className="h-4 w-4" />;
    if (status.status === "unsupported" || status.status === "error") return <WifiOff className="h-4 w-4" />;
    return <QrCode className="h-4 w-4" />;
  }, [loading, status.status]);

  return (
    <>
      <Header
        title="Katababump"
        description="Alternative WhatsApp WebJS panel for deployment visibility"
        actions={
          <button
            type="button"
            onClick={refreshStatus}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-owly-border text-owly-text-light hover:text-owly-text hover:bg-owly-primary-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl space-y-6">
          <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="border border-owly-border rounded-lg bg-owly-surface overflow-hidden">
              <div className="px-5 py-4 border-b border-owly-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
                    <MonitorCog className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-owly-text">WhatsApp WebJS Runtime</h3>
                    <p className="text-xs text-owly-text-light mt-0.5">
                      Uses the existing `/api/channels/whatsapp` endpoint.
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium capitalize",
                    statusTone(status.status)
                  )}
                >
                  {statusIcon}
                  {loading ? "checking" : statusLabel(status.status)}
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
                <div className="h-64 rounded-lg border border-owly-border bg-white flex items-center justify-center overflow-hidden">
                  {loading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                  ) : status.qr ? (
                    <Image
                      src={status.qr}
                      alt="Katababump WhatsApp QR code"
                      width={236}
                      height={236}
                      className="h-full w-full object-contain p-3"
                      unoptimized
                    />
                  ) : (
                    <div className="text-center px-6">
                      <QrCode className="h-11 w-11 text-owly-text-light/40 mx-auto mb-2" />
                      <p className="text-sm font-medium text-owly-text">QR code display</p>
                      <p className="text-xs text-owly-text-light mt-1">
                        It appears here when the WebJS worker can run.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-owly-border bg-owly-bg p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-owly-text-light mb-2">
                      Current message
                    </p>
                    <p className="text-sm text-owly-text">{status.message ?? "No status message yet."}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => runAction("connect")}
                      disabled={busyAction !== null || status.status === "unsupported"}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {busyAction === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction("disconnect")}
                      disabled={busyAction !== null || status.status === "unsupported"}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {busyAction === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
                      Disconnect
                    </button>
                  </div>

                  {status.status === "unsupported" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-2">
                        <Server className="h-4 w-4 text-amber-700 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          Vercel can display this panel, but whatsapp-web.js needs a long-running Node process with browser storage.
                          Run the worker elsewhere and use this panel as the visible dashboard.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-owly-border rounded-lg bg-owly-surface p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-owly-primary-50 text-owly-primary">
                  <Terminal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-owly-text">Deployment Notes</h3>
                  <p className="text-xs text-owly-text-light mt-0.5">Keep Vercel for UI, move WebJS runtime to a worker.</p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-owly-text">
                <p>
                  This page is intentionally separate from the main Channels screen. It gives Katababump a dedicated route while preserving the existing setup.
                </p>
                <p>
                  On Vercel, the existing API returns an unsupported status for WebJS so builds remain stable. A long-running server can expose QR/status data later.
                </p>
                <a
                  href="/channels"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-owly-primary hover:text-owly-primary-dark"
                >
                  Open existing Channels page
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <CodeBlock title="Long-running worker example" code={workerExample} />
            <CodeBlock title="Vercel bridge environment" code={vercelBridgeExample} />
          </section>
        </div>
      </div>

      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium",
            toast.type === "success" ? "bg-owly-success text-white" : "bg-owly-danger text-white"
          )}
        >
          {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}
    </>
  );
}
