import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag, Clock, XCircle, DollarSign, Flame, Calendar, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, Area, AreaChart } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { orders, ordersByHour, statusColor, statusLabel, dailyRevenue } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Delivery Auto Pro" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const todayCount = orders.length;
  const yesterdayCount = todayCount - 4; // Mock
  const pending = orders.filter((o) => o.status === "pending").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const avgTicket = revenue / todayCount;
  const avgPrep = Math.round(orders.reduce((s, o) => s + o.prepTime, 0) / orders.length);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral operacional do seu restaurante hoje."
        actions={<Button variant="outline" size="sm">Hoje</Button>}
      />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatCard label="Pedidos hoje" value={String(todayCount)} delta="+12% vs ontem" icon={ShoppingBag} tone="primary" />
          <StatCard label="Pendentes" value={String(pending)} delta="Aguardando aceite" icon={Clock} tone="warning" />
          <StatCard label="Cancelados" value={String(cancelled)} delta="-2% vs ontem" icon={XCircle} tone="danger" />
          <StatCard label="Ticket Médio" value={`R$ ${avgTicket.toFixed(0)}`} delta="+5% vs ontem" icon={DollarSign} tone="success" />
          <StatCard label="Faturamento" value={`R$ ${revenue.toFixed(0)}`} delta="+8% vs ontem" icon={Flame} tone="primary" />
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
                <span>+15.4%</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenue}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip 
                    cursor={{ stroke: 'var(--primary)', strokeWidth: 1 }} 
                    contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }} 
                  />
                  <Area type="monotone" dataKey="faturamento" stroke="var(--primary)" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Resumo por canal</h3>
            <p className="text-xs text-muted-foreground">Pedidos por marketplace hoje</p>
            <div className="mt-4 space-y-3">
              {["iFood", "Keeta", "99Food"].map((m) => {
                const count = orders.filter((o) => o.marketplace === m).length;
                const pct = Math.round((count / orders.length) * 100);
                return (
                  <div key={m}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{m}</span>
                      <span className="text-muted-foreground">{count} pedidos</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Volume de Pedidos (7 dias)</h3>
                <p className="text-xs text-muted-foreground">Quantidade total por dia da semana</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="pedidos" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Pico de Demanda (Hoje)</h3>
                <p className="text-xs text-muted-foreground">Distribuição horária dos pedidos</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ordersByHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="pedidos" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h3 className="text-sm font-semibold">Últimos pedidos</h3>
              <p className="text-xs text-muted-foreground">Atividade recente em todos os canais</p>
            </div>
            <Button variant="outline" size="sm">Ver todos</Button>
          </div>
          <div className="divide-y">
            {orders.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                    {o.code.slice(1, 3)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.code} · {o.customer}</p>
                    <p className="truncate text-xs text-muted-foreground">{o.marketplace} · {o.store}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className={statusColor[o.status]}>{statusLabel[o.status]}</Badge>
                  <span className="hidden text-sm font-semibold sm:inline">R$ {o.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}