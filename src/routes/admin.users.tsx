import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAdminUsers,
  getAdminUser,
  updateAdminUser,
  createAdminUser,
  type AdminUser,
  type AdminInvoice,
  type PaymentStatus,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-slate-200 text-slate-700",
  pro: "bg-blue-100 text-blue-700",
  enterprise: "bg-purple-100 text-purple-700",
};
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-slate-200 text-slate-700",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};

function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<
    (AdminUser & { invoices?: AdminInvoice[] }) | null
  >(null);
  const [creating, setCreating] = useState(false);

  const refetch = () => {
    setLoading(true);
    return getAdminUsers()
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refetch();
  }, []);

  const openDetails = async (u: AdminUser) => {
    try {
      const full = await getAdminUser(u.id);
      setSelected(full);
    } catch {
      setSelected({ ...u, invoices: [] });
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500">Gestão de contas e planos</p>
        </div>
        <Button onClick={() => setCreating(true)}>Novo Usuário</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status Pgto</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Ativo</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td colSpan={7} className="p-3">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              users.map((u, idx) => (
                <tr
                  key={u.id}
                  className={`cursor-pointer border-t hover:bg-slate-50 ${
                    idx % 2 === 1 ? "bg-slate-50/40" : ""
                  }`}
                  onClick={() => openDetails(u)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={PLAN_COLORS[u.plan] ?? ""} variant="secondary">
                      {u.plan}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={STATUS_COLORS[u.payment_status] ?? ""}
                      variant="secondary"
                    >
                      {STATUS_LABELS[u.payment_status] ?? u.payment_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{u.is_admin ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3">{u.active ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetails(u); }}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <UserDetailsDialog
          user={selected}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            await refetch();
            setSelected(null);
          }}
        />
      )}
      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onSaved={async () => {
            await refetch();
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function UserDetailsDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser & { invoices?: AdminInvoice[] };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [plan, setPlan] = useState(user.plan);
  const [active, setActive] = useState(user.active);
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(user.payment_status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminUser(user.id, {
        name,
        email,
        plan,
        active,
        is_admin: isAdmin,
        payment_status: paymentStatus,
      });
      toast.success("Usuário atualizado!");
      await onSaved();
    } catch {
      // toast already shown
    } finally {
      setSaving(false);
    }
  };

  const suspend = async () => {
    setSaving(true);
    try {
      await updateAdminUser(user.id, { active: false, payment_status: "suspended" });
      toast.success("Acesso suspenso");
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Usuário</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status de Pagamento</Label>
            <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Ativo</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Admin</Label>
            <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700">Faturas</div>
          <div className="max-h-40 overflow-auto rounded-md border">
            {(user.invoices ?? []).length === 0 ? (
              <div className="p-3 text-sm text-slate-400">Nenhuma fatura</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Valor</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {(user.invoices ?? []).map((inv) => (
                    <tr key={inv.id} className="border-t">
                      <td className="px-3 py-2">{inv.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">R$ {Number(inv.amount).toFixed(2)}</td>
                      <td className="px-3 py-2">{inv.status}</td>
                      <td className="px-3 py-2">{inv.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={suspend} disabled={saving}>
            Suspender Acesso
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "enterprise">("starter");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name || !email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      await createAdminUser({ name, email, password, plan, is_admin: role === "admin" });
      toast.success("Usuário criado!");
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}