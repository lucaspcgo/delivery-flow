import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check, Clock, Flame, X, Search, Filter } from "lucide-react";
import { orders as initialOrders, statusColor, statusLabel, type Order, type OrderStatus } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Pedidos — Delivery Auto Pro" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const [list, setList] = useState<Order[]>(initialOrders);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    return list.filter((o) => {
      const matchStatus = status === "all" || o.status === status;
      const matchQ = !q || o.code.toLowerCase().includes(q.toLowerCase()) || o.customer.toLowerCase().includes(q.toLowerCase());
      return matchStatus && matchQ;
    });
  }, [list, status, q]);

  const update = (id: string, s: OrderStatus, label: string) => {
    setList((prev) => prev.map((o) => (o.id === id ? { ...o, status: s } : o)));
    setSelected((p) => (p && p.id === id ? { ...p, status: s } : p));
    toast.success(`Pedido ${label}`);
  };

  return (
    <div>
      <PageHeader title="Pedidos" description={`${filtered.length} pedidos · atualizado agora`} />
      <div className="space-y-4 p-4 sm:p-8">
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código ou cliente..." className="h-10 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus | "all")}>
              <SelectTrigger className="h-10 w-full sm:w-56">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.keys(statusLabel) as OrderStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="hidden grid-cols-12 gap-3 border-b bg-muted/50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <div className="col-span-2">Código</div>
            <div className="col-span-3">Cliente</div>
            <div className="col-span-2">Canal</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Preparo</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          <div className="divide-y">
            {filtered.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelected(o)}
                className="grid w-full grid-cols-2 gap-3 px-5 py-4 text-left transition hover:bg-muted/40 md:grid-cols-12 md:items-center"
              >
                <div className="col-span-2 font-mono text-sm font-semibold">{o.code}</div>
                <div className="col-span-3">
                  <p className="truncate text-sm font-medium">{o.customer}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.store}</p>
                </div>
                <div className="col-span-2 text-sm text-muted-foreground">{o.marketplace}</div>
                <div className="col-span-2"><Badge variant="outline" className={statusColor[o.status]}>{statusLabel[o.status]}</Badge></div>
                <div className="col-span-1 text-sm text-muted-foreground">{o.prepTime}m</div>
                <div className="col-span-2 text-right text-sm font-semibold">R$ {o.total.toFixed(2)}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</div>
            )}
          </div>
        </Card>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Pedido {selected.code}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5">
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="text-sm font-semibold">{selected.customer}</p>
                  </div>
                  <Badge variant="outline" className={statusColor[selected.status]}>{statusLabel[selected.status]}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Canal</p>
                    <p className="font-medium">{selected.marketplace}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Loja</p>
                    <p className="font-medium">{selected.store}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Preparo</p>
                    <p className="font-medium">{selected.prepTime} min</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-semibold">R$ {selected.total.toFixed(2)}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Itens</p>
                  <div className="space-y-2">
                    {selected.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <span>{it.qty}× {it.name}</span>
                        <span className="font-medium">R$ {(it.qty * it.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => update(selected.id, "accepted", "aceito")} variant="outline"><Check className="mr-2 h-4 w-4" />Aceitar</Button>
                  <Button onClick={() => update(selected.id, "preparing", "em preparo")} variant="outline"><Clock className="mr-2 h-4 w-4" />Iniciar preparo</Button>
                  <Button onClick={() => update(selected.id, "ready", "pronto")} className="bg-emerald-600 hover:bg-emerald-700"><Flame className="mr-2 h-4 w-4" />Marcar pronto</Button>
                  <Button onClick={() => update(selected.id, "cancelled", "cancelado")} variant="destructive"><X className="mr-2 h-4 w-4" />Cancelar</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}