import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      <div className="flex items-center justify-center rounded-full bg-gabriel-primary-50 p-4 mb-4">
        <Icon className="h-8 w-8 text-gabriel-primary" />
      </div>
      <h3 className="text-base font-semibold text-gabriel-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gabriel-text-light">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 rounded-lg bg-gabriel-primary px-4 py-2 text-sm font-medium text-white hover:bg-gabriel-primary-dark transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
