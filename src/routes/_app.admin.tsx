import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  http,
  auth,
  hasAdminAccess,
  hasStoredAdminAccess,
  hasStoredManagerAccess,
  getStoredUserRole,
  getPlansAdmin,
  createPlan,
  updatePlanDB,
  deletePlan,
  getPlansPublic,
  updateAdminUser,
  getAdminInvoices,
  updateAdminInvoice,
  getUserRoleHistory,
  PLAN_PERIOD_LABEL,
  type MeResponse,
  type DBPlan,
  type DBPlanInput,
  type AppRole,
  type AdminInvoice as ApiAdminInvoice,
  type AdminInvoicesSummary,
  type RoleAuditEntry,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Pencil, Trash2, Plus, Star, KeyRound, Copy, Check, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, Search, TrendingUp, TrendingDown, Users, AlertTriangle, Clock, DollarSign, ShoppingBag, Store, Zap } from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel Administrativo — Zero Tempo" }] }),
  component: AdminPage,
});

type Plan = "starter" | "pro" | "enterprise";
type PaymentStatus = "active" | "pending" | "suspended" | "cancelled";
type InvoiceStatus = "pending" | "paid" | "failed" | "cancelled" | "overdue";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  payment_status: PaymentStatus;
  is_admin: boolean;
  active?: boolean;
  created_at?: string;
  phone?: string;
  plan_expires_at?: string | null;
  role?: AppRole | string;
}

type AdminInvoice = ApiAdminInvoice;

type AdminPlanRow = DBPlan;

interface AdminStats {
  users?: { total?: number; ativos?: number };
  invoices?: { receita?: number; pendentes?: number };
  restaurants?: number;
  orders?: { total?: number; gmv?: number };
  clientes?: {
    novos_mes?: number;
    novos_mes_anterior?: number;
    vencendo_7d?: number;
    vencidos?: number;
  };
  financeiro?: {
    mrr_estimado?: number;
    assinantes_pagantes?: number;
    receita_mes?: number;
    crescimento_receita_pct?: number;
    em_atraso?: number;
    em_atraso_valor?: number;
  };
  operacao?: {
    pedidos_mes?: number;
    pedidos_hoje?: number;
    taxa_automacao_mes_pct?: number;
    lojas_ifood?: number;
    lojas_99food?: number;
  };
}

const BRL = (v: number | undefined) =>
  `R$ ${Number(v ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function maskBrPhoneAdmin(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const planLabel: Record<Plan, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

function PlanBadge({ plan }: { plan: Plan }) {
  const cls =
    plan === "starter"
      ? "bg-muted text-muted-foreground"
      : plan === "pro"
        ? "bg-blue-100 text-blue-700"
        : "bg-purple-100 text-purple-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {planLabel[plan]}
    </span>
  );
}

function PayStatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, string> = {
    active: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-800",
    suspended: "bg-red-100 text-red-700",
    cancelled: "bg-gray-200 text-gray-700",
  };
  const label: Record<PaymentStatus, string> = {
    active: "Ativo",
    pending: "Pendente",
    suspended: "Suspenso",
    cancelled: "Cancelado",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function RoleBadge({ role, isAdmin }: { role?: string; isAdmin?: boolean }) {
  const normalized = (role ?? "").toLowerCase();
  const key: "admin" | "gerente" | "user" =
    isAdmin === true
      ? "admin"
      : normalized === "gerente" || normalized === "manager"
        ? "gerente"
        : "user";
  const cls: Record<typeof key, string> = {
    admin: "bg-green-100 text-green-700",
    gerente: "bg-yellow-100 text-yellow-800",
    user: "bg-gray-200 text-gray-700",
  };
  const label: Record<typeof key, string> = {
    admin: "Admin",
    gerente: "Gerente",
    user: "Cliente",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[key]}`}>
      {label[key]}
    </span>
  );
}


function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-gray-200 text-gray-700",
    overdue: "bg-red-100 text-red-700",
  };
  const label: Record<InvoiceStatus, string> = {
    pending: "Pendente",
    paid: "Paga",
    failed: "Falhou",
    cancelled: "Cancelada",
    overdue: "Em atraso",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {label[status] ?? status}
    </span>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const storedAdmin = hasStoredManagerAccess();
  const [status, setStatus] = useState<"checking" | "ok" | "denied">(
    storedAdmin ? "ok" : "checking",
  );
  const [role, setRole] = useState<AppRole | null>(() => getStoredUserRole());
  const [activeTab, setActiveTab] = useState<string>("overview");
  const isSuperAdmin = role === "admin";

  useEffect(() => {
    let alive = true;
    if (hasStoredManagerAccess()) {
      setStatus("ok");
      setRole(getStoredUserRole());
      return () => {
        alive = false;
      };
    }

    auth
      .me()
      .then((me: MeResponse) => {
        if (!alive) return;
        if (hasAdminAccess(me) || (me as { role?: string }).role === "gerente") {
          setStatus("ok");
          setRole(getStoredUserRole());
        } else if (hasStoredManagerAccess()) {
          setStatus("ok");
          setRole(getStoredUserRole());
        } else {
          setStatus("denied");
          toast.error("Acesso negado", {
            description: "Você não tem permissão para acessar o painel administrativo.",
          });
          navigate({ to: "/dashboard" });
        }
      })
      .catch(() => {
        if (!alive) return;
        if (hasStoredManagerAccess()) {
          setStatus("ok");
          return;
        }
        setStatus("denied");
        navigate({ to: "/login" });
      });
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (!storedAdmin && status !== "ok") {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {status === "checking" ? "Verificando permissões..." : "Redirecionando..."}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Painel Administrativo"
        description="Gerencie usuários, faturas, planos e configurações."
      />
      <div className="p-4 sm:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="invoices">Faturas</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="plans">Planos</TabsTrigger>}
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="automation-audit">Automação</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="settings">Configurações</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab onNavigate={setActiveTab} />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab isSuperAdmin={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="invoices">
            <InvoicesTab />
          </TabsContent>
          {isSuperAdmin && (
            <TabsContent value="plans">
              <PlansTab />
            </TabsContent>
          )}
          <TabsContent value="audit">
            <AuditTab />
          </TabsContent>
          <TabsContent value="automation-audit">
            <AutomationAuditTab />
          </TabsContent>
          {isSuperAdmin && (
            <TabsContent value="settings">
              <SettingsTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function OverviewTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http
      .get<AdminStats>("/admin/stats", { silent: true })
      .then(setStats)
      .catch(() => toast.error("Erro ao carregar estatísticas"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const clientes = stats?.clientes ?? {};
  const financeiro = stats?.financeiro ?? {};
  const operacao = stats?.operacao ?? {};

  const novos = clientes.novos_mes ?? 0;
  const novosAnt = clientes.novos_mes_anterior ?? 0;
  const novosDiff = novos - novosAnt;
  const novosPct = novosAnt > 0 ? (novosDiff / novosAnt) * 100 : (novos > 0 ? 100 : 0);
  const novosUp = novosDiff >= 0;

  const crescReceita = financeiro.crescimento_receita_pct ?? 0;
  const crescUp = crescReceita >= 0;

  const taxaAuto = Math.max(0, Math.min(100, financeiro && (operacao.taxa_automacao_mes_pct ?? 0)));

  const goInvoices = () => onNavigate?.("invoices");

  return (
    <div className="space-y-8">
      {/* Cards atuais (mantidos) */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Resumo geral</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Total de Usuários" value={String(stats?.users?.total ?? 0)} sub={`${stats?.users?.ativos ?? 0} ativos`} />
          <MetricCard title="Receita Total" value={BRL(stats?.invoices?.receita)} />
          <MetricCard title="Faturas Pendentes" value={String(stats?.invoices?.pendentes ?? 0)} />
          <MetricCard title="Restaurantes" value={String(stats?.restaurants ?? 0)} />
          <MetricCard title="Total de Pedidos" value={String(stats?.orders?.total ?? 0)} />
          <MetricCard title="GMV" value={BRL(stats?.orders?.gmv)} />
        </div>
      </section>

      {/* CLIENTES */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Clientes</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Novos no mês"
            icon={<Users className="h-4 w-4" />}
            value={String(novos)}
            sub={
              <span className={`inline-flex items-center gap-1 ${novosUp ? "text-emerald-600" : "text-red-600"}`}>
                {novosUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {novosUp ? "+" : ""}{novosDiff} ({novosPct.toFixed(1)}%) vs mês anterior
              </span>
            }
          />
          <MetricCard
            title="Vencendo em 7 dias"
            icon={<Clock className="h-4 w-4 text-amber-600" />}
            value={String(clientes.vencendo_7d ?? 0)}
            tone="warning"
            onClick={goInvoices}
          />
          <MetricCard
            title="Vencidos"
            icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
            value={String(clientes.vencidos ?? 0)}
            tone="danger"
            onClick={goInvoices}
          />
        </div>
      </section>

      {/* FINANCEIRO */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Financeiro</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="MRR estimado"
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
            value={`${BRL(financeiro.mrr_estimado)}/mês`}
            sub={`${financeiro.assinantes_pagantes ?? 0} assinantes`}
          />
          <MetricCard
            title="Receita do mês"
            icon={<DollarSign className="h-4 w-4" />}
            value={BRL(financeiro.receita_mes)}
            sub={
              <span className={`inline-flex items-center gap-1 ${crescUp ? "text-emerald-600" : "text-red-600"}`}>
                {crescUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {crescUp ? "+" : ""}{crescReceita.toFixed(1)}%
              </span>
            }
          />
          <MetricCard
            title="Em atraso"
            icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
            value={`${financeiro.em_atraso ?? 0} faturas`}
            sub={<span className="text-red-600">{BRL(financeiro.em_atraso_valor)}</span>}
            tone="danger"
            onClick={goInvoices}
          />
        </div>
      </section>

      {/* OPERAÇÃO */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Operação</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pedidos no mês"
            icon={<ShoppingBag className="h-4 w-4" />}
            value={String(operacao.pedidos_mes ?? 0)}
          />
          <MetricCard
            title="Pedidos hoje"
            icon={<ShoppingBag className="h-4 w-4" />}
            value={String(operacao.pedidos_hoje ?? 0)}
          />
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Zap className="h-4 w-4 text-emerald-600" />
                Taxa de automação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{taxaAuto.toFixed(1)}%</p>
              <Progress value={taxaAuto} className="mt-2 h-2" />
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Store className="h-4 w-4" />
                Lojas conectadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-4">
                <div>
                  <p className="text-2xl font-semibold">{operacao.lojas_ifood ?? 0}</p>
                  <p className="text-xs text-muted-foreground">iFood</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{operacao.lojas_99food ?? 0}</p>
                  <p className="text-xs text-muted-foreground">99Food</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  sub,
  icon,
  tone,
  onClick,
}: {
  title: string;
  value: string;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "warning" | "danger" | "success";
  onClick?: () => void;
}) {
  const toneCls =
    tone === "warning"
      ? "border-amber-300 bg-amber-50"
      : tone === "danger"
        ? "border-red-300 bg-red-50"
        : tone === "success"
          ? "border-emerald-300 bg-emerald-50"
          : "";
  const clickable = onClick ? "cursor-pointer hover:shadow-md transition-shadow" : "";
  return (
    <Card
      onClick={onClick}
      className={`rounded-xl shadow-sm ${toneCls} ${clickable}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function UsersTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [plans, setPlans] = useState<DBPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [query, setQuery] = useState("");


  const load = () => {
    setLoading(true);
    http
      .get<AdminUser[]>("/admin/users", { silent: true })
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Erro ao carregar usuários"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Admin endpoint returns ALL plans (incl. inactive); fallback to public list on 403.
    getPlansAdmin()
      .then((p) => setPlans(Array.isArray(p) ? p : []))
      .catch(() =>
        getPlansPublic()
          .then((p) => setPlans(Array.isArray(p) ? p : []))
          .catch(() => setPlans([])),
      );
  }, []);

  const save = async (
    userId: string,
    data: {
      plan?: string;
      active?: boolean;
      payment_status?: string;
      phone?: string;
      role?: string;
      previous_role?: string;
    },
  ): Promise<import("@/lib/api").AdminUser | null> => {
    setSaving(true);
    try {
      const updated = await updateAdminUser(userId, data as Partial<import("@/lib/api").AdminUser>);
      const newExpiry = updated?.plan_expires_at ?? null;
      if (data.plan && newExpiry) {
        const d = new Date(newExpiry);
        const dateStr = !isNaN(d.getTime())
          ? `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : newExpiry;
        toast.success(`Usuário atualizado — válido até ${dateStr}`);
      } else {
        toast.success("Usuário atualizado");
      }
      setConfirmDeactivate(null);
      load();
      return updated;
    } catch (e: unknown) {
      const err = e as { status?: number; payload?: { error?: string }; message?: string };
      const msg =
        err?.payload?.error ||
        (err?.status === 400 ? "Plano inválido" : "Erro ao atualizar usuário");
      toast.error(msg);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const normalizedRole = (r?: string) => (r ?? "").toLowerCase();
  const effectiveRole = (u: AdminUser) => {
    if (u.is_admin === true) return "admin";
    if (normalizedRole(u.role) === "gerente" || normalizedRole(u.role) === "manager") return "gerente";
    return "user";
  };
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "all" && effectiveRole(u) !== roleFilter) return false;
    if (q && !(u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))) return false;
    return true;
  });


  return (
    <>
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Usuários</CardTitle>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full max-w-[160px]">
              <SelectValue placeholder="Todos os perfis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="gerente">Gerente</SelectItem>
              <SelectItem value="user">Cliente</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou email"
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status Pgto</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u, i) => (
                  <TableRow key={u.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {u.phone ? u.phone : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <PlanBadge plan={u.plan} />
                    </TableCell>
                    <TableCell>
                      <PayStatusBadge status={u.payment_status} />
                    </TableCell>
                     <TableCell>
                       <RoleBadge role={u.role} isAdmin={u.is_admin} />
                     </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        {isSuperAdmin && (
                          <Button size="sm" variant="outline" onClick={() => setResetting(u)}>
                            <KeyRound className="h-3 w-3 mr-1" /> Redefinir senha
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>


    <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>Ajuste plano e status da conta.</DialogDescription>
        </DialogHeader>
        {editing && (
          <UserEditForm
            key={editing.id}
            user={editing}
            plans={plans}
            saving={saving}
            isSuperAdmin={isSuperAdmin}
            onCancel={() => setEditing(null)}
            onDeactivateAsk={(u) => setConfirmDeactivate(u)}
            onSave={async (data) => {
              const updated = await save(editing.id, data);
              if (updated) {
                setEditing((prev) =>
                  prev ? { ...prev, ...updated } : prev,
                );
              }
              return updated;
            }}
            onResetPassword={(u) => setResetting(u)}
            onRenewed={(planExpiresAt) => {
              setEditing((prev) =>
                prev ? { ...prev, plan_expires_at: planExpiresAt } : prev,
              );
              load();
            }}
          />
        )}
      </DialogContent>
    </Dialog>

    <ResetPasswordDialog
      user={resetting}
      onOpenChange={(o) => !o && setResetting(null)}
    />

    <AlertDialog open={!!confirmDeactivate} onOpenChange={(o) => !o && setConfirmDeactivate(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
          <AlertDialogDescription>
            O usuário perderá o acesso ao sistema até ser reativado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              confirmDeactivate && save(confirmDeactivate.id, { active: false })
            }
          >
            Desativar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function UserEditForm({
  user,
  plans,
  saving,
  isSuperAdmin,
  onCancel,
  onSave,
  onDeactivateAsk,
  onResetPassword,
  onRenewed,
}: {
  user: AdminUser;
  plans: DBPlan[];
  saving: boolean;
  isSuperAdmin: boolean;
  onCancel: () => void;
  onSave: (data: {
    plan?: string;
    active?: boolean;
    payment_status?: string;
    phone?: string;
    role?: string;
    previous_role?: string;
  }) => Promise<import("@/lib/api").AdminUser | null>;
  onDeactivateAsk: (u: AdminUser) => void;
  onResetPassword: (u: AdminUser) => void;
  onRenewed: (planExpiresAt: string | null) => void;
}) {
  const [plan, setPlan] = useState<string>(user.plan ?? "");
  const [active, setActive] = useState<boolean>(user.active ?? true);
  const [paymentStatus, setPaymentStatus] = useState<string>(user.payment_status);
  const [phone, setPhone] = useState<string>(user.phone ?? "");
  const initialRole: string =
    typeof user.role === "string" && user.role
      ? user.role
      : user.is_admin
        ? "admin"
        : "user";
  const [role, setRole] = useState<string>(initialRole);
  const [renewing, setRenewing] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(user.plan_expires_at ?? null);
  const [roleHistory, setRoleHistory] = useState<RoleAuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [roleChangeConfirmOpen, setRoleChangeConfirmOpen] = useState(false);


  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await getUserRoleHistory(user.id);
      const list = Array.isArray(res) ? res : res?.history ?? [];
      setRoleHistory(list);
    } catch (e: unknown) {
      const err = e as { status?: number; payload?: { error?: string } };
      if (err?.status === 404) {
        setRoleHistory([]);
      } else {
        setHistoryError(err?.payload?.error || "Não foi possível carregar o histórico");
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (isSuperAdmin) void loadHistory();
  }, [isSuperAdmin, loadHistory]);

  const fmtBrDate = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const renew = async () => {
    setRenewing(true);
    try {
      const res = await http.post<{ days?: number; plan_expires_at?: string | null }>(
        `/admin/users/${user.id}/renew`,
        {},
        { silent: true },
      );
      const newExpiry = res?.plan_expires_at ?? null;
      setExpiresAt(newExpiry);
      onRenewed(newExpiry);
      const days = res?.days ?? 0;
      toast.success(
        `Acesso renovado por ${days} dias — vence em ${fmtBrDate(newExpiry)}`,
      );
    } catch (e: unknown) {
      const err = e as { payload?: { error?: string }; message?: string };
      toast.error(err?.payload?.error || err?.message || "Erro ao renovar acesso");
    } finally {
      setRenewing(false);
    }
  };

  const saveChanges = async () => {
    if (user.active && !active) {
      onDeactivateAsk(user);
      return;
    }
    const payload: {
      plan?: string;
      active?: boolean;
      payment_status?: string;
      phone?: string;
      role?: string;
      previous_role?: string;
    } = {
      plan,
      active,
      payment_status: paymentStatus,
      phone: phone.trim() ? phone : "",
    };
    if (isSuperAdmin) {
      payload.role = role;
      if (role !== initialRole) {
        payload.previous_role = initialRole;
      }
    }
    const updated = await onSave(payload);
    if (updated && updated.plan_expires_at !== undefined) {
      setExpiresAt(updated.plan_expires_at ?? null);
    }
    if (isSuperAdmin && role !== initialRole) {
      // Refresh audit trail after a role change
      void loadHistory();
    }
  };

  const submit = () => {
    if (isSuperAdmin && role !== initialRole) {
      setRoleChangeConfirmOpen(true);
      return;
    }
    void saveChanges();
  };

  const confirmRoleChange = () => {
    setRoleChangeConfirmOpen(false);
    void saveChanges();
  };


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-xs text-muted-foreground">ID</Label>
          <p className="truncate">{user.id}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Criado em</Label>
          <p>{fmtBrDate(user.created_at)}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <p>{user.name}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          <p className="truncate">{user.email}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Válido até</Label>
          <p>{fmtBrDate(expiresAt)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div>
          <p className="text-sm font-medium">Renovar acesso</p>
          <p className="text-xs text-muted-foreground">
            Adiciona +1 ciclo ao plano do usuário.
          </p>
        </div>
        <Button size="sm" onClick={renew} disabled={renewing}>
          {renewing ? "Renovando..." : "Renovar acesso (+1 ciclo)"}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-phone">Telefone</Label>
        <Input
          id="edit-phone"
          type="tel"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={phone}
          onChange={(e) => setPhone(maskBrPhoneAdmin(e.target.value))}
          maxLength={16}
        />
      </div>

      <div className="space-y-2">
        <Label>Plano</Label>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger>
            <SelectValue placeholder={plans.length === 0 ? "Carregando planos..." : "Selecione um plano"} />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.slug}>
                {p.name} ({p.slug})
              </SelectItem>
            ))}
            {plan && !plans.some((p) => p.slug === plan) && (
              <SelectItem value={plan}>{plan} (atual)</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Status de pagamento</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="suspended">Suspenso</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isSuperAdmin && (
        <div className="space-y-2">
          <Label>Perfil</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Cliente</SelectItem>
              <SelectItem value="gerente">Gerente</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Define os acessos do usuário no painel.
          </p>
        </div>
      )}

      {isSuperAdmin && (
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Histórico de perfil</p>
              <p className="text-xs text-muted-foreground">
                Alterações de perfil registradas (quem alterou e quando).
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
            >
              {historyLoading ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
          {historyError ? (
            <p className="text-xs text-destructive">{historyError}</p>
          ) : historyLoading && roleHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : roleHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
              {roleHistory.map((h, idx) => {
                const when = h.changed_at
                  ? (() => {
                      const d = new Date(h.changed_at);
                      return isNaN(d.getTime())
                        ? h.changed_at
                        : `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
                    })()
                  : "—";
                const who =
                  h.changed_by_name || h.changed_by_email || h.changed_by || "—";
                return (
                  <li
                    key={h.id ?? `${when}-${idx}`}
                    className="rounded border bg-muted/30 p-2"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <RoleBadge role={h.previous_role ?? undefined} />
                      <span className="text-muted-foreground">→</span>
                      <RoleBadge role={h.new_role ?? undefined} />
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      por <span className="font-medium text-foreground">{who}</span> em {when}
                    </p>
                    {h.reason ? (
                      <p className="text-muted-foreground">Motivo: {h.reason}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Conta ativa</p>
          <p className="text-xs text-muted-foreground">
            Desativar remove o acesso do usuário.
          </p>
        </div>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {isSuperAdmin ? (
          <Button
            variant="outline"
            type="button"
            onClick={() => onResetPassword(user)}
          >
            <KeyRound className="h-3 w-3 mr-1" /> Redefinir senha
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogFooter>

      <AlertDialog open={roleChangeConfirmOpen} onOpenChange={(o) => !o && setRoleChangeConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar perfil do usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está alterando o perfil de <span className="font-medium">{user.name ?? user.email}</span> de{" "}
              <RoleBadge role={initialRole} /> para <RoleBadge role={role} />.
              Essa mudança afeta os acessos no painel administrativo. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleChangeConfirmOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>Confirmar alteração</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}


function ResetPasswordDialog({
  user,
  onOpenChange,
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTemp, setShowTemp] = useState(false);

  useEffect(() => {
    if (user) {
      setMode("choose");
      setNewPassword("");
      setTempPassword(null);
      setCopied(false);
      setSubmitting(false);
      setShowPassword(false);
      setShowTemp(false);
    }
  }, [user]);

  if (!user) return null;

  const call = async (body: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const res = await http.post<{ temporary_password?: string }>(
        `/admin/users/${user.id}/reset-password`,
        body,
        { silent: true },
      );
      if (res?.temporary_password) {
        setTempPassword(res.temporary_password);
      }
      toast.success(`Senha redefinida para ${user.email}`);
      if (!res?.temporary_password) onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { payload?: { error?: string }; message?: string };
      toast.error(err?.payload?.error || err?.message || "Erro ao redefinir senha");
    } finally {
      setSubmitting(false);
    }
  };

  const submitManual = () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    call({ new_password: newPassword });
  };

  const copy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Usuário: <span className="font-medium">{user.email}</span>
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-3">
            <Label>Senha temporária</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={tempPassword}
                type={showTemp ? "text" : "password"}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowTemp((v) => !v)}
                aria-label={showTemp ? "Ocultar senha" : "Mostrar senha"}
              >
                {showTemp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Repasse esta senha ao usuário. Peça para ele trocá-la depois em Configurações.
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : mode === "choose" ? (
          <div className="space-y-3">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => setMode("manual")}
            >
              <Pencil className="h-4 w-4 mr-2" /> Digitar nova senha
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={submitting}
              onClick={() => call({})}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {submitting ? "Gerando..." : "Gerar senha temporária"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setMode("choose")}>
                Voltar
              </Button>
              <Button onClick={submitManual} disabled={submitting || newPassword.length < 6}>
                {submitting ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvoicesTab() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [summary, setSummary] = useState<AdminInvoicesSummary>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customer, setCustomer] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: Parameters<typeof getAdminInvoices>[0] = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (customer.trim()) params.email = customer.trim();
    if (from) params.from = from;
    if (to) params.to = to;
    if (onlyOverdue) params.overdue = 1;
    getAdminInvoices(params)
      .then((d) => {
        if (Array.isArray(d)) {
          setInvoices(d);
          setSummary({});
        } else {
          setInvoices(Array.isArray(d?.invoices) ? d.invoices : []);
          setSummary(d?.summary ?? {});
        }
      })
      .catch(() => toast.error("Erro ao carregar faturas"))
      .finally(() => setLoading(false));
  }, [statusFilter, customer, from, to, onlyOverdue]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (inv: AdminInvoice, status: "paid" | "cancelled") => {
    setActing(inv.id);
    try {
      await updateAdminInvoice(inv.id, { status });
      toast.success(status === "paid" ? "Fatura marcada como paga" : "Fatura cancelada");
      load();
    } catch (e: unknown) {
      const err = e as { payload?: { error?: string }; message?: string };
      toast.error(err?.payload?.error || err?.message || "Erro ao atualizar fatura");
    } finally {
      setActing(null);
    }
  };

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  const summaryCards = [
    { label: "Pendente", value: BRL(summary.total_pending) },
    { label: "Pago", value: BRL(summary.total_paid) },
    { label: "Em atraso", value: BRL(summary.total_overdue) },
    { label: "Nº em atraso", value: String(summary.overdue_count ?? 0) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <p className="mt-1 text-xl font-bold tracking-tight">
                {loading ? "—" : c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="gap-3 space-y-0">
          <CardTitle className="text-base">Faturas</CardTitle>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Paga</SelectItem>
                <SelectItem value="overdue">Em atraso</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Cliente (nome ou email)"
            />
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="De"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Até"
            />
            <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
              <Switch checked={onlyOverdue} onCheckedChange={setOnlyOverdue} />
              Só em atraso
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv, i) => (
                    <TableRow key={inv.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                      <TableCell>
                        <div className="font-medium">{inv.user_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{inv.user_email}</div>
                        {inv.user_phone && (
                          <div className="text-xs text-muted-foreground">{inv.user_phone}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {inv.plan_name ?? inv.plan ?? "—"}
                        </div>
                        {inv.billing_period && (
                          <div className="text-xs text-muted-foreground">
                            {PLAN_PERIOD_LABEL[inv.billing_period as keyof typeof PLAN_PERIOD_LABEL] ?? inv.billing_period}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{BRL(inv.amount)}</TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(inv.due_date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(inv.paid_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {inv.days_overdue && inv.days_overdue > 0 ? (
                          <span className="text-red-600 font-medium">
                            {inv.days_overdue}d
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{inv.payment_gateway ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {inv.status !== "paid" && inv.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={acting === inv.id}
                              onClick={() => setStatus(inv, "paid")}
                            >
                              Marcar paga
                            </Button>
                          )}
                          {inv.status !== "cancelled" && inv.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={acting === inv.id}
                              onClick={() => setStatus(inv, "cancelled")}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {invoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        Nenhuma fatura.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DBPlan | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DBPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getPlansAdmin()
      .then((d) => setPlans(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Erro ao carregar planos"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async (data: DBPlanInput, id?: string) => {
    // slug validation
    if (!data.slug || !/^[a-z0-9-]+$/.test(data.slug)) {
      toast.error("Slug deve conter apenas letras minúsculas, números e hifens");
      return;
    }
    if (data.price != null && data.price < 0) {
      toast.error("Preço deve ser maior ou igual a zero");
      return;
    }
    if (!id) {
      const exists = plans.some((p) => p.slug === data.slug);
      if (exists) {
        toast.error("Slug já existe");
        return;
      }
    }
    setSaving(true);
    try {
      if (id) {
        await updatePlanDB(id, data);
        toast.success("Plano atualizado");
      } else {
        await createPlan(data);
        toast.success("Plano criado");
      }
      setEditing(null);
      load();
    } catch {
      toast.error("Erro ao salvar plano");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (p: DBPlan) => {
    try {
      await deletePlan(p.id);
      toast.success("Plano removido");
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Erro ao remover plano");
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-1" /> Novo plano
        </Button>
      </div>
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Popular</TableHead>
                    <TableHead>Free</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Max Rest.</TableHead>
                    <TableHead>Max Pedidos</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p, i) => (
                    <TableRow key={p.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.slug}</TableCell>
                      <TableCell>{BRL(p.price ?? 0)}</TableCell>
                      <TableCell className="text-xs">{PLAN_PERIOD_LABEL[p.billing_period ?? p.period ?? ""] ?? (p.billing_period ?? p.period ?? "—")}</TableCell>
                      <TableCell>
                        {p.popular ? <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {p.is_free ? <Badge variant="secondary">Free</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                          {p.active ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell>{p.max_restaurants === 0 ? "Ilimitado" : p.max_restaurants}</TableCell>
                      <TableCell>{p.max_orders_per_month === 0 ? "Ilimitado" : p.max_orders_per_month}</TableCell>
                      <TableCell>{p.display_order}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setConfirmDelete(p)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                        Nenhum plano.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Novo plano" : "Editar plano"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <PlanForm
              key={editing === "new" ? "new" : editing.id}
              plan={editing === "new" ? null : editing}
              saving={saving}
              onCancel={() => setEditing(null)}
              onSave={(data) => submit(data, editing === "new" ? undefined : editing.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover plano?</AlertDialogTitle>
            <AlertDialogDescription>
              O plano "{confirmDelete?.name}" será desativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && doDelete(confirmDelete)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlanForm({
  plan,
  saving,
  onCancel,
  onSave,
}: {
  plan: DBPlan | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (data: DBPlanInput) => void;
}) {
  const normalizePeriod = (v?: string) => {
    const raw = (v ?? "").toLowerCase().trim();
    if (raw === "weekly" || raw === "semanal") return "weekly";
    if (raw === "monthly" || raw === "mensal") return "monthly";
    if (raw === "yearly" || raw === "annual" || raw === "anual") return "yearly";
    if (raw === "one_time" || raw === "único" || raw === "unico") return "one_time";
    if (raw === "free" || raw === "gratuito" || raw === "grátis") return "free";
    return "monthly";
  };

  const [name, setName] = useState(plan?.name ?? "");
  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [price, setPrice] = useState<string>(String(plan?.price ?? 0));
  const [period, setPeriod] = useState<string>(normalizePeriod(plan?.billing_period ?? plan?.period ?? "monthly"));
  const [active, setActive] = useState(plan?.active ?? true);
  const [popular, setPopular] = useState(plan?.popular ?? false);
  const [isFree, setIsFree] = useState(plan?.is_free ?? false);
  const [menuSync, setMenuSync] = useState(plan?.menu_sync ?? false);
  const [autoAccept, setAutoAccept] = useState(plan?.auto_accept ?? false);
  const [features, setFeatures] = useState((plan?.features ?? []).join("\n"));
  const [maxRest, setMaxRest] = useState<string>(String(plan?.max_restaurants ?? 0));
  const [maxOrders, setMaxOrders] = useState<string>(String(plan?.max_orders_per_month ?? 0));
  const [displayOrder, setDisplayOrder] = useState<string>(String(plan?.display_order ?? 0));

  const submit = () => {
    if (!name.trim()) return toast.error("Nome é obrigatório");
    if (!slug.trim()) return toast.error("Slug é obrigatório");
    const priceNum = Number(price);
    if (Number.isNaN(priceNum)) return toast.error("Preço inválido");
    onSave({
      name: name.trim(),
      slug: slug.trim(),
      price: priceNum,
      period: period as DBPlan["period"],
      billing_period: period,
      active,
      popular,
      is_free: isFree,
      menu_sync: menuSync,
      auto_accept: autoAccept,
      features: features.split("\n").map((s) => s.trim()).filter(Boolean),
      max_restaurants: Math.max(0, Math.floor(Number(maxRest) || 0)),
      max_orders_per_month: Math.max(0, Math.floor(Number(maxOrders) || 0)),
      display_order: Math.floor(Number(displayOrder) || 0),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="starter-pro" />
        </div>
        <div className="space-y-1">
          <Label>Preço (R$)</Label>
          <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
              <SelectItem value="one_time">Único</SelectItem>
              <SelectItem value="free">Gratuito</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Label className="text-sm">Ativo</Label>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Label className="text-sm">Popular</Label>
          <Switch checked={popular} onCheckedChange={setPopular} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Label className="text-sm">Gratuito</Label>
          <Switch checked={isFree} onCheckedChange={setIsFree} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Label className="text-sm">Menu Sync</Label>
          <Switch checked={menuSync} onCheckedChange={setMenuSync} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Label className="text-sm">Auto Accept</Label>
          <Switch checked={autoAccept} onCheckedChange={setAutoAccept} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Recursos (um por linha)</Label>
        <Textarea
          rows={5}
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          placeholder="Aceite automático de pedidos&#10;Sincronização de cardápio&#10;App mobile"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Max Restaurantes</Label>
          <Input type="number" min="0" value={maxRest} onChange={(e) => setMaxRest(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">0 = ilimitado</p>
        </div>
        <div className="space-y-1">
          <Label>Max Pedidos/mês</Label>
          <Input type="number" min="0" value={maxOrders} onChange={(e) => setMaxOrders(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">0 = ilimitado</p>
        </div>
        <div className="space-y-1">
          <Label>Ordem</Label>
          <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </div>
  );
}

function SettingsTab() {
  const [mpKey, setMpKey] = useState("");
  const [stripeKey, setStripeKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await http.post("/admin/settings", {
        mercadopago_key: mpKey,
        stripe_key: stripeKey,
      });
      toast.success("Configurações salvas");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Chaves de API</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="mp">Mercado Pago Access Token</Label>
          <Input
            id="mp"
            type="password"
            value={mpKey}
            onChange={(e) => setMpKey(e.target.value)}
            placeholder="APP_USR-..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stripe">Stripe Secret Key</Label>
          <Input
            id="stripe"
            type="password"
            value={stripeKey}
            onChange={(e) => setStripeKey(e.target.value)}
            placeholder="sk_live_..."
          />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}

interface AuditSummary {
  users: number;
  active_users: number;
  stores_connected: number;
  ifood_stores: number;
  food99_stores: number;
}

interface AuditUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  billing_period?: string | null;
  active: boolean;
  payment_status: string;
  created_at: string;
  stores_connected: number;
  ifood_stores: number;
  food99_stores: number;
  last_order_at: string | null;
  orders_total: number;
  plan_expires_at?: string | null;
}

interface AuditResponse {
  summary: AuditSummary;
  users: AuditUser[];
}

type AuditSortKey = "created_at" | "stores_connected" | "orders_total";

function AuditTab() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<AuditSortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [recalculating, setRecalculating] = useState(false);

  const loadAudit = useCallback((signal?: { alive: boolean }) => {
    setLoading(true);
    return http
      .get<AuditResponse>("/admin/audit")
      .then((res) => {
        if (!signal || signal.alive) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!signal || signal.alive) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const signal = { alive: true };
    loadAudit(signal);
    return () => {
      signal.alive = false;
    };
  }, [loadAudit]);

  async function handleRecalculate() {
    if (
      !window.confirm(
        "Recalcular a data de validade de todos os clientes com base na data de criação + ciclo do plano?",
      )
    )
      return;
    setRecalculating(true);
    try {
      const res = await http.post<{ success?: boolean; updated?: number }>(
        "/admin/recalculate-expiry",
        {},
      );
      const n = res?.updated ?? 0;
      toast.success(`Validades recalculadas para ${n} cliente(s).`);
      await loadAudit();
    } catch (err: any) {
      toast.error(err?.payload?.error || err?.message || "Erro ao recalcular validades");
    } finally {
      setRecalculating(false);
    }
  }

  function toggleSort(key: AuditSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIcon(key: AuditSortKey) {
    if (sortKey !== key) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  }

  const users = data?.users ?? [];
  const planOptions = Array.from(
    new Set(users.map((u) => (u.plan ?? "").trim()).filter(Boolean)),
  ).sort();
  const q = query.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (planFilter !== "all" && u.plan !== planFilter) return false;
    if (q && !(u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)))
      return false;
    return true;
  });
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        let av: number = 0;
        let bv: number = 0;
        if (sortKey === "created_at") {
          av = new Date(a.created_at).getTime() || 0;
          bv = new Date(b.created_at).getTime() || 0;
        } else {
          av = a[sortKey] ?? 0;
          bv = b[sortKey] ?? 0;
        }
        return sortDir === "asc" ? av - bv : bv - av;
      })
    : filtered;

  const summary = data?.summary;
  const isFiltered = planFilter !== "all";
  const filteredSummary = {
    users: filtered.length,
    active_users: filtered.filter((u) => u.active).length,
    stores_connected: filtered.reduce((s, u) => s + (u.stores_connected ?? 0), 0),
    ifood_stores: filtered.reduce((s, u) => s + (u.ifood_stores ?? 0), 0),
    food99_stores: filtered.reduce((s, u) => s + (u.food99_stores ?? 0), 0),
  };
  const cards: { label: string; value: number | string }[] = [
    { label: "Cadastros", value: isFiltered ? filteredSummary.users : summary?.users ?? 0 },
    { label: "Ativos", value: isFiltered ? filteredSummary.active_users : summary?.active_users ?? 0 },
    { label: "Lojas conectadas", value: isFiltered ? filteredSummary.stores_connected : summary?.stores_connected ?? 0 },
    { label: "Lojas iFood", value: isFiltered ? filteredSummary.ifood_stores : summary?.ifood_stores ?? 0 },
    { label: "Lojas 99food", value: isFiltered ? filteredSummary.food99_stores : summary?.food99_stores ?? 0 },
  ];

  function fmtDateTime(iso?: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {loading ? "—" : c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Usuários</CardTitle>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              {recalculating ? "Recalculando..." : "Recalcular validades"}
            </Button>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full max-w-[200px]">
                <SelectValue placeholder="Todos os planos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                {planOptions.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou email"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cadastro</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("created_at")}
                >
                  Criado em{sortIcon("created_at")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("stores_connected")}
                >
                  Lojas{sortIcon("stores_connected")}
                </TableHead>
                <TableHead>Último pedido</TableHead>
                <TableHead>Válido até</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => toggleSort("orders_total")}
                >
                  Total de pedidos{sortIcon("orders_total")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="capitalize w-fit">
                          {u.plan}
                        </Badge>
                        {u.billing_period ? (
                          <span className="text-xs text-muted-foreground">
                            {PLAN_PERIOD_LABEL[u.billing_period] ?? u.billing_period}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(u.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{u.stores_connected}</div>
                      <div className="text-xs text-muted-foreground">
                        iFood: {u.ifood_stores} · 99food: {u.food99_stores}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(u.last_order_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(u.plan_expires_at)}</TableCell>
                    <TableCell className="text-right font-medium">{u.orders_total}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
