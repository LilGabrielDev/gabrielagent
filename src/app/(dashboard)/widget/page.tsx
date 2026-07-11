"use client";

import { Header } from "@/components/layout/header";
import {
  MessageSquare,
  Save,
  Loader2,
  Copy,
  CheckCircle,
  XCircle,
  Palette,
  AlignLeft,
  AlignRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetConfig {
  title: string;
  greeting: string;
  color: string;
  position: "right" | "left";
}

interface ChannelData {
  id: string | null;
  type: string;
  isActive: boolean;
  config: Record<string, unknown>;
  status: string;
}

// ---------------------------------------------------------------------------
// Color presets
// ---------------------------------------------------------------------------

const COLOR_PRESETS = [
  { label: "Dark", value: "#0F172A" },
  { label: "Blue", value: "#2563EB" },
  { label: "Green", value: "#16A34A" },
  { label: "Purple", value: "#7C3AED" },
  { label: "Orange", value: "#EA580C" },
  { label: "Pink", value: "#DB2777" },
  { label: "Teal", value: "#0D9488" },
  { label: "Red", value: "#DC2626" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const isConnected = status === "connected";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        isConnected
          ? "bg-gabriel-success/10 text-gabriel-success"
          : "bg-gabriel-border text-gabriel-text-light"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isConnected ? "bg-gabriel-success" : "bg-gabriel-text-light"
        )}
      />
      {isConnected ? "Active" : "Inactive"}
    </span>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2",
        enabled
          ? "bg-gabriel-primary focus:ring-gabriel-primary/30"
          : "bg-gabriel-border focus:ring-gabriel-text-light/30"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Widget Config Card
// ---------------------------------------------------------------------------

function getWidgetCfg(config: Record<string, unknown>): WidgetConfig {
  return {
    title: (config.title as string) || "Support Chat",
    greeting: (config.greeting as string) || "Hi! How can we help you today?",
    color: (config.color as string) || "#0F172A",
    position: (config.position as "right" | "left") || "right",
  };
}

function WidgetConfigCard({
  channel,
  onSave,
  saving,
  onToggleActive,
}: {
  channel: ChannelData;
  onSave: (config: Record<string, unknown>, isActive: boolean) => void;
  saving: boolean;
  onToggleActive: (active: boolean) => void;
}) {
  const cfg = getWidgetCfg(channel.config);
  const [isActive, setIsActive] = useState(channel.isActive);
  const [title, setTitle] = useState(cfg.title);
  const [greeting, setGreeting] = useState(cfg.greeting);
  const [color, setColor] = useState(cfg.color);
  const [position, setPosition] = useState<"right" | "left">(cfg.position);
  const [copied, setCopied] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://your-gabriel-instance.com";

  // Use unicode escape for quotes inside HTML attribute values to avoid JSX issues
  const q = "\\u0022";
  const escTitle = title.replace(/"/g, q);
  const escGreeting = greeting.replace(/"/g, q);

  const embedCode = [
    '<script src="' + baseUrl + '/widget/gabriel-chat.js"',
    '  data-server="' + baseUrl + '"',
    '  data-color="' + color + '"',
    '  data-position="' + position + '"',
    '  data-greeting="' + escGreeting + '"',
    '  data-title="' + escTitle + '"',
    "></script>",
  ].join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = embedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggle = (v: boolean) => {
    setIsActive(v);
    onToggleActive(v);
  };

  const handleSave = () => {
    onSave({ title, greeting, color, position }, isActive);
  };

  return (
    <div className="bg-gabriel-surface rounded-xl border border-gabriel-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gabriel-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: color + "20", color }}
            >
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gabriel-text">
                Live Chat Widget
              </h3>
              <p className="text-xs text-gabriel-text-light mt-0.5">
                Embeddable chat widget for customer websites
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={isActive ? "connected" : "disconnected"} />
            <Toggle enabled={isActive} onChange={handleToggle} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Configuration fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gabriel-text-light mb-1">
                Widget Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Support Chat"
                className="w-full px-3 py-2 text-sm border border-gabriel-border rounded-lg bg-gabriel-bg text-gabriel-text placeholder:text-gabriel-text-light/50 focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30 focus:border-gabriel-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gabriel-text-light mb-1">
                Position
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPosition("right")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                    position === "right"
                      ? "border-gabriel-primary/30 bg-gabriel-primary/10 text-gabriel-primary"
                      : "border-gabriel-border bg-gabriel-bg text-gabriel-text-light hover:bg-gabriel-primary-50 hover:text-gabriel-text"
                  )}
                >
                  <AlignRight className="h-4 w-4" />
                  Right
                </button>
                <button
                  type="button"
                  onClick={() => setPosition("left")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                    position === "left"
                      ? "border-gabriel-primary/30 bg-gabriel-primary/10 text-gabriel-primary"
                      : "border-gabriel-border bg-gabriel-bg text-gabriel-text-light hover:bg-gabriel-primary-50 hover:text-gabriel-text"
                  )}
                >
                  <AlignLeft className="h-4 w-4" />
                  Left
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gabriel-text-light mb-1">
              Greeting Message
            </label>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Hi! How can we help you today?"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gabriel-border rounded-lg bg-gabriel-bg text-gabriel-text placeholder:text-gabriel-text-light/50 focus:outline-none focus:ring-2 focus:ring-gabriel-primary/30 focus:border-gabriel-primary transition-colors resize-none"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-gabriel-text-light mb-2">
              <Palette className="h-3.5 w-3.5 inline mr-1" />
              Accent Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all",
                    color === preset.value
                      ? "border-gabriel-text scale-110 shadow-sm"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
              <div className="relative">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border-2 border-gabriel-border cursor-pointer overflow-hidden"
                  title="Custom color"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Widget preview */}
        <div>
          <label className="block text-xs font-medium text-gabriel-text-light mb-2">
            Preview
          </label>
          <div
            className="relative rounded-xl border border-gabriel-border overflow-hidden bg-white"
            style={{ minHeight: "200px" }}
          >
            <div className="p-4 space-y-2">
              <div className="h-3 w-48 rounded-full bg-gray-200" />
              <div className="h-3 w-32 rounded-full bg-gray-100" />
              <div className="h-3 w-40 rounded-full bg-gray-100" />
            </div>

            <div
              className={cn(
                "absolute bottom-4",
                position === "right" ? "right-4" : "left-4"
              )}
            >
              <div
                className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer"
                style={{ backgroundColor: color }}
              >
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
            </div>

            <div
              className={cn(
                "absolute bottom-20 w-72 rounded-xl shadow-xl border border-gray-200 bg-white overflow-hidden",
                position === "right" ? "right-4" : "left-4"
              )}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: color }}
              >
                <span className="text-sm font-semibold text-white">
                  {title || "Support Chat"}
                </span>
              </div>
              <div className="p-4">
                <div
                  className="max-w-[80%] p-3 rounded-xl text-sm leading-relaxed"
                  style={{
                    backgroundColor: color + "15",
                    color: "#1E293B",
                    borderBottomLeftRadius: "4px",
                  }}
                >
                  {greeting || "Hi! How can we help you today?"}
                </div>
              </div>
              <div className="border-t border-gray-100 p-3 flex gap-2">
                <div className="flex-1 h-8 rounded-lg border border-gray-200 bg-gray-50" />
                <div
                  className="w-16 h-8 rounded-lg flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  Send
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Embed code */}
        <div>
          <label className="block text-xs font-medium text-gabriel-text-light mb-2">
            Embed Code
          </label>
          <div className="relative">
            <pre className="w-full p-4 text-xs font-mono bg-gabriel-bg border border-gabriel-border rounded-lg overflow-x-auto text-gabriel-text">
              {embedCode}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-gabriel-surface border border-gabriel-border text-gabriel-text-light hover:text-gabriel-text hover:border-gabriel-text-light/50 transition-colors"
              title="Copy embed code"
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 text-gabriel-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          {copied && (
            <p className="text-xs text-gabriel-success mt-1">
              Copied to clipboard!
            </p>
          )}
          <p className="text-xs text-gabriel-text-light mt-2">
            Paste this code just before the closing {"</body>"} tag on your website. The widget will appear automatically.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gabriel-border bg-gabriel-bg/50">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gabriel-primary rounded-lg hover:bg-gabriel-primary-dark disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Widget Settings
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WidgetPage() {
  const [channel, setChannel] = useState<ChannelData>({
    id: null,
    type: "widget",
    isActive: false,
    config: {},
    status: "disconnected",
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const fetchChannel = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch("/api/channels/widget");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setChannel(data);
    } catch {
      setFetchError("Failed to load widget settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  const handleSave = async (
    config: Record<string, unknown>,
    isActive: boolean
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/channels/widget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, isActive }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setChannel(updated);
      showToast("Widget settings saved successfully");
    } catch {
      showToast("Failed to save widget settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (active: boolean) => {
    try {
      const res = await fetch("/api/channels/widget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setChannel(updated);
    } catch {
      showToast("Failed to update widget status", "error");
    }
  };

  if (loading) {
    return (
      <>
        <Header
          title="Live Chat Widget"
          description="Embeddable chat widget for your customer websites"
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gabriel-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Live Chat Widget"
        description="Embeddable chat widget for your customer websites"
      />

      <div className="flex-1 overflow-auto p-6">
        {fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-medium text-gabriel-text">
              Could not load widget settings
            </p>
            <p className="text-sm text-gabriel-text-light mt-1">
              {fetchError}
            </p>
            <button
              onClick={() => {
                setLoading(true);
                fetchChannel();
              }}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-gabriel-primary rounded-lg hover:bg-gabriel-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <WidgetConfigCard
              channel={channel}
              onSave={handleSave}
              saving={saving}
              onToggleActive={handleToggleActive}
            />
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-bottom-4 duration-300",
            toast.type === "success"
              ? "bg-gabriel-success text-white"
              : "bg-gabriel-danger text-white"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}
    </>
  );
}
