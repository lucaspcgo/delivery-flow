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
    <Card className="interactive-lift p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</p>
          {delta && (
            <p className={cn(
              "mt-1 text-xs font-medium",
              delta.includes("+") ? "text-success" : delta.includes("-") ? "text-destructive" : "text-muted-foreground"
            )}>
              {delta}
            </p>
          )}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", toneBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
