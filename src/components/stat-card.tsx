import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}) {
  const toneBg = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/15 text-primary",
    success: "bg-success-muted text-success",
    warning: "bg-warning-muted text-warning-foreground",
    danger: "bg-destructive-muted text-destructive",
  }[tone];

  return (
    <Card className="interactive-lift p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p
        title={value}
        className="mt-2 truncate text-xl font-bold leading-tight tracking-tight tabular-nums sm:text-2xl"
      >
        {value}
      </p>
      {delta && (
        <p
          className={cn(
            "mt-1 truncate text-xs font-medium",
            delta.includes("+")
              ? "text-success"
              : delta.includes("-")
                ? "text-destructive"
                : "text-muted-foreground",
          )}
          title={delta}
        >
          {delta}
        </p>
      )}
    </Card>
  );
}
