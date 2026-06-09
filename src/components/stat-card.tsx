import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

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
  tone?: "default" | "primary" | "success" | "warning";
}) {
  const toneBg = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {delta && <p className="mt-1 text-xs text-muted-foreground">{delta}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}