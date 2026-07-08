import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "bg-gabriel-primary-50 text-gabriel-primary",
}: StatCardProps) {
  return (
    <div className="bg-gabriel-surface rounded-xl border border-gabriel-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gabriel-text-light">{title}</p>
          <p className="text-2xl font-bold text-gabriel-text mt-1">{value}</p>
          {change && (
            <p
              className={cn(
                "text-xs mt-1 font-medium",
                changeType === "positive" && "text-gabriel-success",
                changeType === "negative" && "text-gabriel-danger",
                changeType === "neutral" && "text-gabriel-text-light"
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className={cn("p-2.5 rounded-lg", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
