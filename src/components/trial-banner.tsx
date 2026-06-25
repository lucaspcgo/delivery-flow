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
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-yellow-200 bg-yellow-50 text-yellow-900",
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={cn("h-4 w-4", urgent ? "text-red-600" : "text-yellow-600")}
        />
        <span>
          {urgent
            ? `Atenção: seu teste grátis termina em ${days} dia${days === 1 ? "" : "s"}. `
            : `Período de teste: ${days} dias restantes. `}
          Assine agora para não perder o acesso.
        </span>
      </div>
      <Button
        size="sm"
        className={cn(
          urgent
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-yellow-600 text-white hover:bg-yellow-700",
        )}
        onClick={() => navigate({ to: "/checkout" })}
      >
        Assinar agora
      </Button>
    </div>
  );
}