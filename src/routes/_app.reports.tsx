import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, ShoppingBag, Timer, XCircle } from "lucide-react";
import { dailyRevenue, orders } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Delivery Auto Pro" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const revenue = dailyRevenue.reduce((s, d) => s + d.faturamento, 0);
  const totalOrders = dailyRevenue.reduce((s, d) => s + d.pedidos, 0);
  const avgTicket = revenue / totalOrders;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;

  return (
    <div>
      <PageHeader title="Relatórios" description="Indicadores operacionais e financeiros dos últimos 7 dias." />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Pedidos (7d)" value={String(totalOrders)} icon={ShoppingBag} tone="primary" />
          <StatCard label="Tempo médio" value="22 min" icon={Timer} />
          <StatCard label="Ticket médio" value={`R$ ${avgTicket.toFixed(2)}`} icon={DollarSign} tone="success" />
          <StatCard label="Cancelamentos" value={String(cancelled)} icon={XCircle} tone="warning" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Pedidos por dia</h3>
            <p className="mb-4 text-xs text-muted-foreground">Volume diário nos últimos 7 dias</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenue}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="pedidos" stroke="var(--primary)" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Faturamento</h3>
            <p className="mb-4 text-xs text-muted-foreground">Receita diária em R$</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="faturamento" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}