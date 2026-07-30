import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMeCached, type MeResponse } from "@/lib/api";

export function TrialBanner() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    getMeCached()
      .then((r) => setMe(r))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (me?.plan === "free" && me.trial_days_left === 0) {
      navigate({ to: "/checkout" });
    }
  }, [me, navigate]);

  if (!me || me.plan !== "free") return null;
  const days = me.trial_days_left ?? 0;
  if (days <= 0) return null;

  const urgent = days <= 2;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm sm:px-6",
        urgent
          ? "bg-destructive-muted text-destructive"
          : "bg-warning-muted text-warning-foreground",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          {urgent
            ? `Atenção: seu teste grátis termina em ${days} dia${days === 1 ? "" : "s"}. `
            : `Período de teste: ${days} dias restantes. `}
          Assine agora para não perder o acesso.
        </span>
      </div>
      <Button
        size="sm"
        variant={urgent ? "destructive" : "default"}
        onClick={() => navigate({ to: "/checkout" })}
      >
        Assinar agora
      </Button>
    </div>
  );
}