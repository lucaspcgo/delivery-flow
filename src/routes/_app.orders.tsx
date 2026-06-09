import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Check, Clock, Flame, X, Search, Filter, ShoppingBag, User, Store, MapPin, Info } from "lucide-react";
import { orders as initialOrders, statusColor, statusLabel, type Order, type OrderStatus } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  const tabs: { label: string; value: OrderStatus | "all" }[] = [
    { label: "Todos", value: "all" },
    { label: "Pendentes", value: "pending" },
    { label: "Aceitos", value: "accepted" },
    { label: "Em preparo", value: "preparing" },
    { label: "Prontos", value: "ready" },
    { label: "Cancelados", value: "cancelled" },
  ];

  return (
    <div>
      <PageHeader title="Gerenciamento de Pedidos" description={`${filtered.length} pedidos encontrados`} />
      
      <div className="space-y-4 p-4 sm:p-8">
        <div className="flex flex-col gap-4">
          <div className="flex overflow-x-auto pb-2 scrollbar-hide gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                variant={status === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatus(tab.value)}
                className="whitespace-nowrap rounded-full"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <Card className="p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                placeholder="Buscar por código, cliente ou marketplace..." 
                className="h-10 border-none bg-transparent pl-9 focus-visible:ring-0 focus-visible:ring-offset-0" 
              />
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden border-none shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Marketplace</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Horário</th>
                  <th className="px-5 py-3">Tempo</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className="cursor-pointer transition hover:bg-muted/40"
                  >
                    <td className="px-5 py-4 font-mono font-bold text-primary">{o.code}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          o.marketplace === "iFood" ? "bg-red-500" : o.marketplace === "Keeta" ? "bg-yellow-500" : "bg-orange-500"
                        )} />
                        {o.marketplace}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium">{o.customer}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {o.prepTime}m
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", statusColor[o.status])}>
                        {statusLabel[o.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right font-bold">R$ {o.total.toFixed(2)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">
                      Nenhum pedido encontrado com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md p-0 overflow-y-auto">
          {selected && (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b bg-muted/20">
                <SheetHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge className={cn("text-[10px] font-bold uppercase", statusColor[selected.status])}>
                      {statusLabel[selected.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(selected.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                    Pedido {selected.code}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Via {selected.marketplace} · {selected.store}
                  </p>
                </SheetHeader>
              </div>

              <div className="p-6 space-y-8">
                {/* Cliente */}
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <User className="h-3 w-3" /> Dados do Cliente
                  </h4>
                  <div className="rounded-xl border p-4 space-y-1">
                    <p className="font-bold">{selected.customer}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Entregar em: Rua das Flores, 123 - Centro
                    </p>
                  </div>
                </section>

                {/* Itens */}
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <ShoppingBag className="h-3 w-3" /> Itens do Pedido
                  </h4>
                  <div className="space-y-3">
                    {selected.items.map((it, i) => (
                      <div key={i} className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                            {it.qty}
                          </span>
                          <div>
                            <p className="text-sm font-bold">{it.name}</p>
                            <p className="text-xs text-muted-foreground">Unitário: R$ {it.price.toFixed(2)}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold">R$ {(it.qty * it.price).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-muted-foreground">Total do Pedido</span>
                        <span className="text-lg font-bold text-primary">R$ {selected.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Observações */}
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <Info className="h-3 w-3" /> Observações
                  </h4>
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
                    Enviar talheres descartáveis e guardanapos extras.
                  </div>
                </section>
              </div>

              <div className="mt-auto p-6 border-t bg-background sticky bottom-0 grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => update(selected.id, "accepted", "aceito")} 
                  variant="outline"
                  className="h-12 border-primary text-primary hover:bg-primary/5"
                >
                  <Check className="mr-2 h-4 w-4" /> Aceitar
                </Button>
                <Button 
                  onClick={() => update(selected.id, "preparing", "em preparo")} 
                  variant="outline"
                  className="h-12"
                >
                  <Clock className="mr-2 h-4 w-4" /> Preparar
                </Button>
                <Button 
                  onClick={() => update(selected.id, "ready", "pronto")} 
                  className="h-12 bg-emerald-600 hover:bg-emerald-700 col-span-2"
                >
                  <Flame className="mr-2 h-4 w-4" /> Marcar como Pronto
                </Button>
                <Button 
                  onClick={() => update(selected.id, "cancelled", "cancelado")} 
                  variant="ghost" 
                  className="col-span-2 text-red-600 hover:text-red-700 hover:bg-red-50 h-10"
                >
                  <X className="mr-2 h-4 w-4" /> Cancelar Pedido
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
