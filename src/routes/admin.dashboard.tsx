import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAdminStats, type AdminStats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

const PLAN_COLORS: Record<string, string> = {
  starter: "#94a3b8",
  pro: "#3b82f6",
  enterprise: "#8b5cf6",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const s = stats ?? ({
    total_users: 0,
    active_users: 0,
    revenue_total: 0,
    invoices_pending: 0,
    total_restaurants: 0,
    total_orders: 0,
    gmv: 0,
    users_by_plan: [],
  } as AdminStats);

  const cards = [
    { title: "Total de Usuários", value: s.total_users, sub: `${s.active_users} ativos` },
    { title: "Receita Total", value: brl(s.revenue_total), sub: "Faturas pagas" },
    { title: "Faturas Pendentes", value: s.invoices_pending, sub: "Aguardando pagamento" },
    { title: "Restaurantes", value: s.total_restaurants, sub: "Cadastrados" },
    { title: "Pedidos", value: s.total_orders, sub: "Volume total" },
    { title: "GMV", value: brl(s.gmv), sub: "Volume bruto" },
  ];

  const pieData = (s.users_by_plan ?? []).map((p) => ({
    name: PLAN_LABELS[p.plan] ?? p.plan,
    value: Number(p.total),
    plan: p.plan,
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visão Geral</h1>
        <p className="text-sm text-slate-500">Métricas administrativas em tempo real</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title} className="rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{c.value}</div>
              <div className="text-xs text-slate-500">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Usuários por Plano</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {pieData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Sem dados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {pieData.map((p, i) => (
                    <Cell key={i} fill={PLAN_COLORS[p.plan] ?? "#cbd5e1"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}