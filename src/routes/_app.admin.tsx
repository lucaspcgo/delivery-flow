import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  http,
  getPlansAdmin,
  createPlan,
  updatePlanDB,
  deletePlan,
  type DBPlan,
  type DBPlanInput,
  type PlanPeriod,
  formatPlanPrice,
  PLAN_PERIOD_LABEL,
} from "@/lib/api";

export const Route = createFileRoute("/_app/admin")({
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
  active: boolean;
}

interface AdminInvoice {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  plan: Plan;
  amount: number;
  status: InvoiceStatus;
  due_date: string;
  paid_at?: string | null;
}

interface AdminStats {
  users?: { total?: number; ativos?: number };
  invoices?: { receita?: number; pendentes?: number };
  restaurants?: number;
  orders?: { total?: number; gmv?: number };
}

const BRL = (v: number | undefined) =>
  `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{planLabel[plan]}</span>;
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
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>{label[status]}</span>;
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
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>{label[status]}</span>;
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("auth_user") || "{}");
      if (user?.is_admin) {
        setAuthorized(true);
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      window.location.href = "/login";
    }
  }, []);

  if (!authorized) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Painel Administrativo"
        description="Gerencie usuários, faturas e configurações da plataforma."
      />
      <div className="p-4 sm:p-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="invoices">Faturas</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="settings">Config. API</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="plans"><PlansTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ---------------- VISÃO GERAL ----------------
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
    { title: "Total de Usuários", value: String(stats?.users?.total ?? 0), sub: `${stats?.users?.ativos ?? 0} ativos` },
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
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

// ---------------- USUÁRIOS ----------------
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = () => {
    setLoading(true);
    http
      .get<AdminUser[]>("/admin/users", { silent: true })
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Erro ao carregar usuários"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>Novo Usuário</Button>
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
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status Pgto</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, i) => (
                  <TableRow key={u.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><PlanBadge plan={u.plan} /></TableCell>
                    <TableCell><PayStatusBadge status={u.payment_status} /></TableCell>
                    <TableCell>{u.is_admin ? <Badge>Sim</Badge> : <span className="text-muted-foreground text-xs">Não</span>}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(u)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <EditUserDialog user={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<Plan>("starter");
  const [isAdmin, setIsAdmin] = useState("user");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await http.post("/admin/users", { name, email, password, plan, is_admin: isAdmin === "admin" });
      toast.success("Usuário criado!");
      onCreated();
      onOpenChange(false);
      setName(""); setEmail(""); setPassword(""); setPlan("starter"); setIsAdmin("user");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div>
            <Label>Plano</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Função</Label>
            <Select value={isAdmin} onValueChange={setIsAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Criando..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<AdminUser | null>(user);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(user); }, [user]);
  if (!form) return null;

  const save = async (overrides?: Partial<AdminUser>) => {
    setSaving(true);
    try {
      const payload = { ...form, ...overrides };
      await http.put(`/admin/users/${form.id}`, payload);
      toast.success("Usuário atualizado!");
      onSaved();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div>
            <Label>Plano</Label>
            <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v as Plan })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status Pagamento</Label>
            <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as PaymentStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Administrador</Label>
            <Switch checked={form.is_admin} onCheckedChange={(v) => setForm({ ...form, is_admin: v })} />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="destructive" onClick={() => save({ payment_status: "suspended" })} disabled={saving}>
            Suspender Acesso
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => save()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- FATURAS ----------------
function InvoicesTab() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    setLoading(true);
    http
      .get<AdminInvoice[]>("/admin/invoices", { silent: true })
      .then((d) => setInvoices(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Erro ao carregar faturas"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    http.get<AdminUser[]>("/admin/users", { silent: true }).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const filtered = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    await http.put(`/admin/invoices/${id}`, { status });
    if (status === "paid") toast.success("Fatura marcada como paga! Acesso do usuário liberado.");
    else toast.success("Fatura atualizada!");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "paid", "failed", "cancelled"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f === "all" ? "Todas" : f === "pending" ? "Pendente" : f === "paid" ? "Paga" : f === "failed" ? "Falhou" : "Cancelada"}
            </Button>
          ))}
        </div>
        <Button onClick={() => setCreateOpen(true)}>Nova Fatura</Button>
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
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv, i) => (
                  <TableRow key={inv.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell>
                      <div className="font-medium">{inv.user_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{inv.user_email}</div>
                    </TableCell>
                    <TableCell><PlanBadge plan={inv.plan} /></TableCell>
                    <TableCell>{BRL(inv.amount)}</TableCell>
                    <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                    <TableCell>{inv.due_date ? new Date(inv.due_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      {inv.status !== "paid" && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(inv.id, "paid")}>
                          Marcar como Pago
                        </Button>
                      )}
                      {inv.status !== "cancelled" && (
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(inv.id, "cancelled")}>Cancelar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma fatura.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} users={users} onCreated={load} />
    </div>
  );
}

function CreateInvoiceDialog({ open, onOpenChange, users, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; users: AdminUser[]; onCreated: () => void }) {
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState<Plan>("starter");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!userId || !amount || !dueDate) { toast.error("Preencha todos os campos"); return; }
    setSaving(true);
    try {
      await http.post("/admin/invoices", { user_id: userId, plan, amount: Number(amount), due_date: dueDate });
      toast.success("Fatura criada!");
      onCreated();
      onOpenChange(false);
      setUserId(""); setPlan("starter"); setAmount(""); setDueDate("");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Fatura</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Usuário</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plano</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Criando..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- CONFIG. API ----------------
function SettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    http
      .get<{ key: string; value: string }[]>("/admin/settings", { silent: true })
      .then((arr) => {
        const map: Record<string, string> = {};
        (Array.isArray(arr) ? arr : []).forEach((s) => { map[s.key] = s.value ?? ""; });
        setSettings(map);
      })
      .catch(() => toast.error("Erro ao carregar configurações"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async (key: string, value: string) => {
    await http.put(`/admin/settings/${key}`, { value });
    toast.success("Configuração salva!");
    setSettings((s) => ({ ...s, [key]: value }));
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Card className="rounded-xl shadow-sm">
        <CardHeader><CardTitle>Gateway Ativo</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.payment_gateway || "mercadopago"}
            onValueChange={(v) => save("payment_gateway", v)}
            className="flex gap-6"
          >
            <label className="flex items-center gap-2"><RadioGroupItem value="mercadopago" /> Mercado Pago</label>
            <label className="flex items-center gap-2"><RadioGroupItem value="stripe" /> Stripe</label>
          </RadioGroup>
        </CardContent>
      </Card>

      <SettingsSection
        title="Mercado Pago"
        fields={[
          { key: "mp_public_key", label: "Public Key" },
          { key: "mp_access_token", label: "Access Token", secret: true },
        ]}
        settings={settings}
        onSave={save}
      />

      <SettingsSection
        title="Stripe"
        fields={[
          { key: "stripe_public_key", label: "Public Key" },
          { key: "stripe_secret_key", label: "Secret Key", secret: true },
        ]}
        settings={settings}
        onSave={save}
      />

      <PlanPricesSection settings={settings} onSave={save} />
    </div>
  );
}

function SettingsSection({ title, fields, settings, onSave }: {
  title: string;
  fields: { key: string; label: string; secret?: boolean }[];
  settings: Record<string, string>;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <SettingField key={f.key} fieldKey={f.key} label={f.label} secret={f.secret} initial={settings[f.key] ?? ""} onSave={onSave} />
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------- PLANOS ----------------
const PERIOD_LABEL = PLAN_PERIOD_LABEL;

const emptyPlanForm: DBPlanInput = {
  name: "",
  slug: "",
  price: 0,
  period: "monthly",
  max_restaurants: 0,
  max_orders_per_month: 0,
  popular: false,
  is_free: false,
  active: true,
  features: [],
  display_order: 0,
};

function PlansTab() {
  const [plans, setPlans] = useState<DBPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DBPlan | null>(null);

  const load = () => {
    setLoading(true);
    getPlansAdmin()
      .then((d) => setPlans(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Erro ao carregar planos"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const formatPrice = (p: DBPlan) => formatPlanPrice(p);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>Novo Plano</Button>
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
                  <TableHead>Gratuito</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p, i) => (
                  <TableRow key={p.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.slug}</TableCell>
                    <TableCell>{formatPrice(p)}</TableCell>
                    <TableCell>{PERIOD_LABEL[p.period] ?? p.period}</TableCell>
                    <TableCell>
                      {p.popular ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Popular</span> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {p.is_free ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Grátis</span> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum plano.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {plans.length > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader><CardTitle>Preview no Checkout</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {plans.filter((p) => p.active).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map((p) => (
                <div key={p.id} className={`relative rounded-2xl border p-4 ${p.popular ? "border-2 border-primary" : ""}`}>
                  {p.popular && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Mais popular</span>
                  )}
                  <h4 className="font-semibold">{p.name}</h4>
                  <p className="mt-2 text-2xl font-bold">{formatPrice(p)}</p>
                  <ul className="mt-3 space-y-1 text-xs">
                    {(p.features ?? []).slice(0, 5).map((f) => (
                      <li key={f} className="flex gap-1.5"><span className="text-green-600">✓</span>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <PlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={load}
        initial={null}
      />
      <PlanDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={load}
        initial={editing}
      />
    </div>
  );
}

function PlanDialog({ open, onOpenChange, onSaved, initial }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  initial: DBPlan | null;
}) {
  const [form, setForm] = useState<DBPlanInput>(emptyPlanForm);
  const [featuresText, setFeaturesText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        slug: initial.slug,
        price: initial.price,
        period: initial.period,
        max_restaurants: initial.max_restaurants ?? 0,
        max_orders_per_month: initial.max_orders_per_month ?? 0,
        popular: initial.popular,
        is_free: initial.is_free,
        active: initial.active,
        features: initial.features ?? [],
        display_order: initial.display_order ?? 0,
      });
      setFeaturesText((initial.features ?? []).join("\n"));
    } else if (open) {
      setForm(emptyPlanForm);
      setFeaturesText("");
    }
  }, [initial, open]);

  const update = <K extends keyof DBPlanInput>(k: K, v: DBPlanInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.slug) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    if (/\s/.test(form.slug ?? "")) {
      toast.error("Slug não pode ter espaços");
      return;
    }
    setSaving(true);
    try {
      const features = featuresText.split("\n").map((s) => s.trim()).filter(Boolean);
      const payload: DBPlanInput = {
        ...form,
        features,
        price: form.is_free ? 0 : Number(form.price ?? 0),
        max_restaurants: Number(form.max_restaurants ?? 0),
        max_orders_per_month: Number(form.max_orders_per_month ?? 0),
        display_order: Number(form.display_order ?? 0),
      };
      if (initial) {
        await updatePlanDB(initial.id, payload);
        toast.success("Plano atualizado!");
      } else {
        await createPlan(payload);
        toast.success("Plano criado!");
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    if (!confirm(`Desativar o plano "${initial.name}"?`)) return;
    setSaving(true);
    try {
      await deletePlan(initial.id);
      toast.success("Plano desativado!");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Plano" : "Novo Plano"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome</Label>
            <Input value={form.name ?? ""} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={form.slug ?? ""} onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="basic" />
          </div>
          <div>
            <Label>Período</Label>
            <Select value={form.period} onValueChange={(v) => update("period", v as PlanPeriod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
                <SelectItem value="one_time">Único</SelectItem>
                <SelectItem value="free">Gratuito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Preço (R$)</Label>
            <Input type="number" step="0.01" disabled={form.is_free} value={form.is_free ? 0 : (form.price ?? 0)} onChange={(e) => update("price", Number(e.target.value))} />
          </div>
          <div>
            <Label>Ordem de Exibição</Label>
            <Input type="number" value={form.display_order ?? 0} onChange={(e) => update("display_order", Number(e.target.value))} />
          </div>
          <div>
            <Label>Máx Restaurantes (0 = ilimitado)</Label>
            <Input type="number" value={form.max_restaurants ?? 0} onChange={(e) => update("max_restaurants", Number(e.target.value))} />
          </div>
          <div>
            <Label>Máx Pedidos/Mês (0 = ilimitado)</Label>
            <Input type="number" value={form.max_orders_per_month ?? 0} onChange={(e) => update("max_orders_per_month", Number(e.target.value))} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Popular</Label>
            <Switch checked={!!form.popular} onCheckedChange={(v) => update("popular", v)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Gratuito</Label>
            <Switch checked={!!form.is_free} onCheckedChange={(v) => { update("is_free", v); if (v) update("price", 0); }} />
          </div>
          {initial && (
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <Label>Ativo</Label>
              <Switch checked={!!form.active} onCheckedChange={(v) => update("active", v)} />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label>Funcionalidades (uma por linha)</Label>
            <Textarea rows={5} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} placeholder={"Até 1 restaurante\nSuporte por email"} />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {initial ? (
            <Button variant="destructive" onClick={onDelete} disabled={saving}>Desativar</Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : initial ? "Salvar" : "Criar Plano"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingField({ fieldKey, label, secret, initial, onSave }: {
  fieldKey: string; label: string; secret?: boolean; initial: string;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(initial), [initial]);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input type={secret ? "password" : "text"} value={value} onChange={(e) => setValue(e.target.value)} />
        <Button onClick={async () => { setSaving(true); try { await onSave(fieldKey, value); } finally { setSaving(false); } }} disabled={saving}>
          {saving ? "..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function PlanPricesSection({ settings, onSave }: { settings: Record<string, string>; onSave: (key: string, value: string) => Promise<void> }) {
  const [starter, setStarter] = useState(settings.plan_starter_price ?? "");
  const [pro, setPro] = useState(settings.plan_pro_price ?? "");
  const [ent, setEnt] = useState(settings.plan_enterprise_price ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setStarter(settings.plan_starter_price ?? "");
    setPro(settings.plan_pro_price ?? "");
    setEnt(settings.plan_enterprise_price ?? "");
  }, [settings]);

  const saveAll = async () => {
    setSaving(true);
    try {
      await onSave("plan_starter_price", starter);
      await onSave("plan_pro_price", pro);
      await onSave("plan_enterprise_price", ent);
    } finally { setSaving(false); }
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader><CardTitle>Preços dos Planos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Starter (R$)</Label><Input type="number" step="0.01" value={starter} onChange={(e) => setStarter(e.target.value)} /></div>
          <div><Label>Pro (R$)</Label><Input type="number" step="0.01" value={pro} onChange={(e) => setPro(e.target.value)} /></div>
          <div><Label>Enterprise (R$)</Label><Input type="number" step="0.01" value={ent} onChange={(e) => setEnt(e.target.value)} /></div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveAll} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}