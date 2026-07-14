import { AlertTriangle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUsage } from "@/lib/usage-context";

export function UsageCounter({ kind }: { kind: "restaurants" | "orders" }) {
  const { usage } = useUsage();
  if (!usage) return null;
  const current = kind === "restaurants" ? usage.restaurants_count : usage.orders_this_month;
  const max = kind === "restaurants" ? usage.max_restaurants : usage.max_orders_month;
  const label = kind === "restaurants" ? "Restaurantes" : "Pedidos este mês";
  const unlimited = !max || max === 0;
  const reached = !unlimited && current >= max;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">
        {current} / {unlimited ? "Ilimitado" : max}
      </span>
      {reached && <Badge variant="destructive">Limite atingido</Badge>}
    </div>
  );
}

export function OverLimitBanner() {
  const { usage } = useUsage();
  const navigate = useNavigate();
  if (!usage?.over_limit) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Você atingiu o limite do plano {usage.plan_name ?? usage.plan}. Faça upgrade
          {usage.next_tier ? ` para ${usage.next_tier}` : ""} para aumentar a capacidade.
        </span>
      </div>
      <Button size="sm" onClick={() => navigate({ to: "/checkout" })}>
        Ver planos
      </Button>
    </div>
  );
}