import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBag, Clock, XCircle, DollarSign, Flame, TrendingUp } from "lucide-react";
import { CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Delivery Auto Pro" }] }),
  component: DashboardPage,
});

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDelta(v: number, suffix = "vs ontem"): string {
  if (!v || Number.isNaN(v)) return `0% ${suffix}`;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}% ${suffix}`;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function formatDay(d: string): string {
  const date = new Date(d);
  if (!Number.isNaN(date.getTime())) return WEEKDAYS[date.getDay()];
  return d;
}

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  ifood: { label: "iFood", color: "#DC2626" },
  "99food": { label: "99Food", color: "#FACC15" },
  keeta: { label: "Keeta", color: "#16A34A" },
};

function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        const r = await getDashboardSummary();
        if (alive) setData(r);
      } catch {
        // erro tratado pelo http (silent=true não mostra toast)
      } finally {
        if (alive && !silent) setLoading(false);
      }
    };
    load(false);
    const id = setInterval(() => load(true), 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral operacional do seu restaurante hoje."
        actions={<Button variant="outline" size="sm">Hoje</Button>}
      />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {loading || !data ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-24" />
                <Skeleton className="mt-2 h-3 w-28" />
              </Card>
            ))
          ) : (
            <>
              <StatCard label="Pedidos hoje" value={String(data.pedidos_hoje)} delta={formatDelta(data.var_pedidos)} icon={ShoppingBag} tone="primary" />
              <StatCard label="Pendentes" value={String(data.pendentes)} delta="Aguardando aceite" icon={Clock} tone="warning" />
              <StatCard label="Cancelados" value={String(data.cancelados)} delta={formatDelta(data.var_cancelados)} icon={XCircle} tone="danger" />
              <StatCard label="Ticket Médio" value={BRL(data.ticket_medio)} icon={DollarSign} tone="success" />
              <StatCard label="Faturamento" value={BRL(data.faturamento)} delta={formatDelta(data.var_faturamento)} icon={Flame} tone="primary" />
            </>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Faturamento Diário</h3>
                <p className="text-xs text-muted-foreground">Evolução financeira dos últimos 7 dias</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                <span>{data ? formatDelta(data.var_faturamento, "") : "—"}</span>
              </div>
            </div>
            <div className="h-64">
              {!data ? (
                <Skeleton className="h-full w-full" />
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.ultimos_7_dias.map((d) => ({ ...d, dia: formatDay(d.dia) }))}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    cursor={{ stroke: 'var(--primary)', strokeWidth: 1 }}
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number, name: string) =>
                      name === "faturamento"
                        ? [BRL(value), "Faturamento"]
                        : [value, "Pedidos"]
                    }
                  />
                  <Area type="monotone" dataKey="faturamento" stroke="var(--primary)" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Resumo por canal</h3>
            <p className="text-xs text-muted-foreground">Pedidos por marketplace hoje</p>
            <div className="mt-4 space-y-3">
              {!data
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i}>
                      <Skeleton className="mb-1 h-3 w-full" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))
                : (() => {
                    const total =
                      data.por_plataforma.reduce((s, p) => s + (p.total ?? 0), 0) || 1;
                    return data.por_plataforma.map((p) => {
                      const key = p.platform?.toLowerCase() ?? "";
                      const meta = PLATFORM_META[key] ?? { label: p.platform, color: "#6B7280" };
                      const pct = Math.round(((p.total ?? 0) / total) * 100);
                      return (
                        <div key={p.platform}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-medium">{meta.label}</span>
                            <span className="text-muted-foreground">{p.total} pedidos</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: meta.color }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}