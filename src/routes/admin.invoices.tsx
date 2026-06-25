import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAdminInvoices,
  createAdminInvoice,
  updateAdminInvoice,
  getAdminUsers,
  type AdminInvoice,
  type AdminUser,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/admin/invoices")({
  component: AdminInvoicesPage,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Paga",
  failed: "Falhou",
};

function AdminInvoicesPage() {
  const [items, setItems] = useState<AdminInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const refetch = () => {
    setLoading(true);
    return getAdminInvoices({
      status: status === "all" ? undefined : status,
      email: search || undefined,
    })
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const markPaid = async (id: string) => {
    try {
      await updateAdminInvoice(id, { status: "paid" });
      toast.success("Fatura marcada como paga!");
      refetch();
    } catch {}
  };
  const cancelInv = async (id: string) => {
    try {
      await updateAdminInvoice(id, { status: "failed" });
      toast.success("Fatura cancelada");
      refetch();
    } catch {}
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Faturas</h1>
          <p className="text-sm text-slate-500">Gestão de cobrança</p>
        </div>
        <Button onClick={() => setCreating(true)}>Nova Fatura</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Paga</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Buscar por email</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refetch()}
            placeholder="usuario@exemplo.com"
          />
        </div>
        <Button variant="secondary" onClick={refetch}>Buscar</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Pago em</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td colSpan={8} className="p-3">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  Nenhuma fatura
                </td>
              </tr>
            ) : (
              items.map((inv, idx) => (
                <tr key={inv.id} className={`border-t ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{inv.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700">{inv.user_email ?? inv.user_name ?? inv.user_id}</td>
                  <td className="px-4 py-3">{inv.plan}</td>
                  <td className="px-4 py-3">R$ {Number(inv.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[inv.status] ?? ""} variant="secondary">
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{inv.due_date}</td>
                  <td className="px-4 py-3">{inv.paid_at ?? "—"}</td>
                  <td className="px-4 py-3 space-x-2">
                    {inv.status !== "paid" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => markPaid(inv.id)}>
                        Marcar como Pago
                      </Button>
                    )}
                    {inv.status !== "failed" && (
                      <Button size="sm" variant="destructive" onClick={() => cancelInv(inv.id)}>
                        Cancelar
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateInvoiceDialog
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

function CreateInvoiceDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userId, setUserId] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "enterprise">("starter");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminUsers().then((u) => setUsers(Array.isArray(u) ? u : [])).catch(() => {});
  }, []);

  const submit = async () => {
    if (!userId || !amount || !dueDate) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      await createAdminInvoice({
        user_id: userId,
        plan,
        amount: Number(amount),
        due_date: dueDate,
      });
      toast.success("Fatura criada!");
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Fatura</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} — {u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Vencimento</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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