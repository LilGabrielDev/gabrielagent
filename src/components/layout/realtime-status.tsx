"use client";

import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useRealtime, type RealtimeStatus } from "@/lib/hooks/use-realtime";

const statusConfig: Record<
  RealtimeStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  connected: {
    label: "Connected",
    icon: Wifi,
    className: "text-green-500",
  },
  connecting: {
    label: "Connecting",
    icon: Loader2,
    className: "text-yellow-500",
  },
  disconnected: {
    label: "Disconnected",
    icon: WifiOff,
    className: "text-gray-400",
  },
  error: {
    label: "Connection Error",
    icon: WifiOff,
    className: "text-red-500",
  },
};

export function RealtimeStatusIndicator() {
  const { status } = useRealtime("global");
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
        status === "connected" && "bg-green-50 text-green-700",
        status === "connecting" && "bg-yellow-50 text-yellow-700",
        status === "disconnected" && "bg-gray-50 text-gray-500",
        status === "error" && "bg-red-50 text-red-700"
      )}
      title={`Real-time: ${config.label}`}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          config.className,
          status === "connecting" && "animate-spin"
        )}
      />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
