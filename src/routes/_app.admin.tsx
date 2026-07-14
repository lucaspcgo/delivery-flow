import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  getPlansAdmin,
  createPlan,
  updatePlanDB,
  deletePlan,
  getPlansPublic,
  updateAdminUser,
  type MeResponse,
  type DBPlan,
  type DBPlanInput,
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
import { Pencil, Trash2, Plus, Star } from "lucide-react";

export const Route = createFileRoute("/_app/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel Administrativo — Zero Tempo" }] }),
  component: AdminPage,
});

type Plan = "starter" | "pro" | "enterprise";
type PaymentStatus = "active" | "pending" | "suspended" | "cancelled";
type InvoiceStatus = "pending" | "paid" | "failed" | "cancelled";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  payment_status: PaymentStatus;
  is_admin: boolean;
}

interface AdminInvoice {
  id: string;
  user_name?: string;
  user_email?: string;
  plan: Plan;
  amount: number;
  status: InvoiceStatus;
  due_date: string;
}

type AdminPlanRow = DBPlan;

interface AdminStats {
  users?: { total?: number; ativos?: number };
  invoices?: { receita?: number; pendentes?: number };
  restaurants?: number;
  orders?: { total?: number; gmv?: number };
}

const BRL = (v: number | undefined) =>
  `R$ ${Number(v ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-gray-200 text-gray-700",
  };
  const label: Record<InvoiceStatus, string> = {
    pending: "Pendente",
    paid: "Paga",
    failed: "Falhou",
    cancelled: "Cancelada",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const storedAdmin = hasStoredAdminAccess();
  const [status, setStatus] = useState<"checking" | "ok" | "denied">(
    storedAdmin ? "ok" : "checking",
  );

  useEffect(() => {
    let alive = true;
    if (hasStoredAdminAccess()) {
      setStatus("ok");
      return () => {
        alive = false;
      };
    }

    auth
      .me()
      .then((me: MeResponse) => {
        if (!alive) return;
        if (hasAdminAccess(me)) {
          setStatus("ok");
        } else if (hasStoredAdminAccess()) {
          setStatus("ok");
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
        if (hasStoredAdminAccess()) {
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
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6 flex flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="invoices">Faturas</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="invoices">
            <InvoicesTab />
          </TabsContent>
          <TabsContent value="plans">
            <PlansTab />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OverviewTab() {
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

  const cards = [
    {
      title: "Total de Usuários",
      value: String(stats?.users?.total ?? 0),
      sub: `${stats?.users?.ativos ?? 0} ativos`,
    },
    { title: "Receita Total", value: BRL(stats?.invoices?.receita) },
    { title: "Faturas Pendentes", value: String(stats?.invoices?.pendentes ?? 0) },
    { title: "Restaurantes", value: String(stats?.restaurants ?? 0) },
    { title: "Total de Pedidos", value: String(stats?.orders?.total ?? 0) },
    { title: "GMV", value: BRL(stats?.orders?.gmv) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.title} className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{c.value}</p>
            {c.sub && <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http
      .get<AdminUser[]>("/admin/users", { silent: true })
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Erro ao carregar usuários"))
      .finally(() => setLoading(false));
  }, []);

  return (
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
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status Pgto</TableHead>
                  <TableHead>Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, i) => (
                  <TableRow key={u.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <PlanBadge plan={u.plan} />
                    </TableCell>
                    <TableCell>
                      <PayStatusBadge status={u.payment_status} />
                    </TableCell>
                    <TableCell>
                      {u.is_admin ? (
                        <Badge>Sim</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum usuário.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoicesTab() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http
      .get<AdminInvoice[]>("/admin/invoices", { silent: true })
      .then((d) => setInvoices(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Erro ao carregar faturas"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv, i) => (
                  <TableRow key={inv.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell>
                      <div className="font-medium">{inv.user_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{inv.user_email}</div>
                    </TableCell>
                    <TableCell>
                      <PlanBadge plan={inv.plan} />
                    </TableCell>
                    <TableCell>{BRL(inv.amount)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>
                      {inv.due_date
                        ? new Date(inv.due_date).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlansAdmin()
      .then((d) => setPlans(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Erro ao carregar planos"))
      .finally(() => setLoading(false));
  }, []);

  return (
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
                  <TableHead>Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p, i) => (
                  <TableRow key={p.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.slug}</TableCell>
                    <TableCell>{BRL(p.price ?? 0)}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
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
