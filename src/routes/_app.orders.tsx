import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  Clock,
  Search,
  ShoppingBag,
  User,
  MapPin,
  Inbox,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getOrders } from "@/lib/api";
import type { ApiOrder, OrderItem, OrderPlatform } from "@/types/order";

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Pedidos — Delivery Auto Pro" }] }),
  component: OrdersPage,
});

type PlatformFilter = "all" | OrderPlatform;

const PLATFORM_TABS: { label: string; value: PlatformFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "iFood", value: "ifood" },
  { label: "99Food", value: "99food" },
  { label: "Keeta", value: "keeta" },
];

const PLATFORM_LABEL: Record<OrderPlatform, string> = {
  ifood: "iFood",
  "99food": "99Food",
  keeta: "Keeta",
};

const PLATFORM_DOT: Record<OrderPlatform, string> = {
  ifood: "bg-red-500",
  "99food": "bg-yellow-500",
  keeta: "bg-emerald-500",
};

const PLATFORM_BADGE: Record<OrderPlatform, string> = {
  ifood: "bg-red-100 text-red-700 border-red-200",
  "99food": "bg-yellow-100 text-yellow-700 border-yellow-200",
  keeta: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

type StatusKind = "new" | "confirmed" | "cancelled" | "other";

function statusKind(status: string): StatusKind {
  const s = String(status).toLowerCase();
  if (s === "100" || s === "new" || s === "pending") return "new";
  if (s === "200" || s === "confirmed" || s === "accepted") return "confirmed";
  if (s === "cancelled" || s === "canceled" || s === "900") return "cancelled";
  return "other";
}

function statusText(status: string): string {
  switch (statusKind(status)) {
    case "new":
      return "Novo";
    case "confirmed":
      return "Confirmado";
    case "cancelled":
      return "Cancelado";
    default:
      return String(status);
  }
}

const STATUS_BADGE: Record<StatusKind, string> = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  other: "bg-muted text-muted-foreground border-border",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.max(0, Math.floor(diff / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function shortOrderId(id: string): string {
  return id.length > 8 ? id.slice(-8) : id;
}

function centsToBRL(cents: number): string {
  return formatBRL((cents ?? 0) / 100);
}

function isSizeOrBorder(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("pequen") ||
    n.includes("médi") ||
    n.includes("medi") ||
    n.includes("grande") ||
    n.includes("família") ||
    n.includes("familia") ||
    n.includes("borda")
  );
}

function OrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [status, setStatus] = useState<"all" | StatusKind>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ApiOrder | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await getOrders(
          platform === "all" ? undefined : platform,
        );
        setOrders(data);
        setError(null);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Falha ao carregar pedidos";
        setError(msg);
        if (!silent) toast.error("Erro ao carregar pedidos");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [platform],
  );

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (status !== "all" && statusKind(o.status) !== status) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = `${o.customer_name ?? ""} ${o.platform_order_id} ${o.id}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, status, q]);

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description={`${filtered.length} pedido(s) encontrado(s)`}
      />

      <div className="space-y-4 p-4 sm:p-8">
        {/* Filtros */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PLATFORM_TABS.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={platform === t.value ? "default" : "outline"}
                onClick={() => setPlatform(t.value)}
                className="whitespace-nowrap rounded-full"
              >
                {t.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Card className="flex-1 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por cliente ou ID do pedido..."
                  className="h-10 border-none bg-transparent pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </Card>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as typeof status)}
            >
              <SelectTrigger className="h-12 w-full sm:w-52">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-12"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw
                className={cn("h-4 w-4", loading && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        {/* Estados */}
        {loading && orders.length === 0 ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-5">
                <Skeleton className="mb-3 h-4 w-32" />
                <Skeleton className="mb-2 h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </Card>
            ))}
          </div>
        ) : error && orders.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os pedidos.
            </p>
            <Button onClick={() => void load()} size="sm">
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum pedido encontrado
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((o) => {
              const kind = statusKind(o.status);
              return (
                <Card
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="cursor-pointer p-5 transition hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md text-[10px] font-bold uppercase",
                            PLATFORM_BADGE[o.platform],
                          )}
                        >
                          <span
                            className={cn(
                              "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                              PLATFORM_DOT[o.platform],
                            )}
                          />
                          {PLATFORM_LABEL[o.platform] ?? o.platform}
                        </Badge>
                        <span className="font-mono text-sm font-bold text-primary">
                          #{shortOrderId(o.platform_order_id)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md text-[10px] font-bold uppercase",
                            STATUS_BADGE[kind],
                          )}
                        >
                          {statusText(o.status)}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {o.customer_name ?? "Cliente não identificado"}
                      </p>
                      <div className="space-y-2 pt-1">
                        {o.items.map((it, i) => (
                          <div key={i} className="text-xs">
                            <div className="flex justify-between gap-2 font-medium text-foreground">
                              <span>
                                {it.name} x{it.amount}
                              </span>
                              <span>{centsToBRL(it.total_price)}</span>
                            </div>
                            {it.sub_item_list && it.sub_item_list.length > 0 && (
                              <ul className="mt-1 space-y-0.5 pl-3 text-muted-foreground">
                                {it.sub_item_list.map((s, j) => {
                                  const showPrice =
                                    !isSizeOrBorder(s.name) &&
                                    (s.total_price ?? 0) > 0;
                                  return (
                                    <li
                                      key={j}
                                      className="flex justify-between gap-2"
                                    >
                                      <span>• {s.name}</span>
                                      {showPrice && (
                                        <span>+{centsToBRL(s.total_price)}</span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t pt-2">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          Total
                        </span>
                        <span className="text-base font-bold text-primary">
                          {formatBRL(o.total_price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {timeAgo(o.created_at)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {kind === "new" && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => toast.success("Pedido aceito")}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Aceitar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => toast.message("Pedido recusado")}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Recusar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detalhes */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
          {selected && (
            <div className="flex h-full flex-col">
              <div className="border-b bg-muted/20 p-6">
                <SheetHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold uppercase",
                        STATUS_BADGE[statusKind(selected.status)],
                      )}
                    >
                      {statusText(selected.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(selected.created_at)}
                    </span>
                  </div>
                  <SheetTitle className="text-2xl font-bold">
                    Pedido #{shortOrderId(selected.platform_order_id)}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    Via {PLATFORM_LABEL[selected.platform] ?? selected.platform}
                  </p>
                </SheetHeader>
              </div>

              <div className="space-y-6 p-6">
                <section>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <User className="h-3 w-3" /> Cliente
                  </h4>
                  <div className="space-y-1 rounded-xl border p-4">
                    <p className="font-bold">
                      {selected.customer_name ?? "Cliente não identificado"}
                    </p>
                    {selected.customer_phone && (
                      <p className="text-sm text-muted-foreground">
                        {selected.customer_phone}
                      </p>
                    )}
                    <p className="flex items-start gap-1 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      {selected.delivery_address ?? "Endereço não informado"}
                    </p>
                  </div>
                </section>

                <section>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <ShoppingBag className="h-3 w-3" /> Itens
                  </h4>
                  <div className="space-y-3">
                    {selected.items.map((it, i) => (
                      <div key={i} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                              {it.amount}
                            </span>
                            <p className="text-sm font-bold">{it.name}</p>
                          </div>
                          <span className="text-sm font-bold">
                            {formatBRL((it.total_price ?? 0) / 100)}
                          </span>
                        </div>
                        {it.sub_item_list && it.sub_item_list.length > 0 && (
                          <ul className="mt-2 space-y-1 border-l-2 border-muted pl-4 text-xs text-muted-foreground">
                            {it.sub_item_list.map((s, j) => {
                              const showPrice =
                                !isSizeOrBorder(s.name) &&
                                (s.total_price ?? 0) > 0;
                              return (
                                <li
                                  key={j}
                                  className="flex justify-between gap-2"
                                >
                                  <span>→ {s.name}</span>
                                  {showPrice && (
                                    <span>+{centsToBRL(s.total_price)}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Resumo
                  </h4>
                  <div className="space-y-2 rounded-xl border p-4 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>
                        {centsToBRL(
                          selected.items.reduce((acc, it) => {
                            const sub = (it.sub_item_list ?? []).reduce(
                              (a, s) => a + (s.total_price ?? 0),
                              0,
                            );
                            return acc + (it.total_price ?? 0) + sub;
                          }, 0),
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="font-bold">Total a pagar</span>
                      <span className="text-lg font-bold text-primary">
                        {formatBRL(selected.total_price)}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {statusKind(selected.status) === "new" && (
                <div className="sticky bottom-0 mt-auto grid grid-cols-2 gap-3 border-t bg-background p-6">
                  <Button
                    className="h-12 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      toast.success("Pedido aceito");
                      setSelected(null);
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" /> Aceitar
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      toast.message("Pedido recusado");
                      setSelected(null);
                    }}
                  >
                    <X className="mr-2 h-4 w-4" /> Recusar
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}