import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Check, X, ChefHat, Loader2, ImageIcon, ChevronDown, ChevronUp, Store, Settings2, GripVertical, Bike } from "lucide-react";
import { toast } from "sonner";
import { getAllOrders, confirmOrder, cancelOrder, readyOrder, dispatchOrder, runOrderAction, getKdsSettings, updateKdsColumns, fetchKdsColumnsStrict, resetKdsSettings, DEFAULT_KDS_COLUMNS, ApiError, type KdsColumn } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
import type { ApiOrder, OrderItem, OrderSubItem } from "@/types/order";

type KdsFieldMap = Record<string, boolean>;
const DEFAULT_KDS_MAP: KdsFieldMap = {
  platform_badge: true,
  order_number: true,
  customer_name: true,
  customer_phone: false,
  order_time: true,
  order_elapsed: true,
  order_type: true,
  payment_method: false,
  delivery_address: false,
  total_price: true,
  item_image: true,
  item_name: true,
  item_quantity: true,
  item_price: false,
  item_subitems: true,
};
const show = (cfg: KdsFieldMap, key: string) =>
  cfg[key] ?? DEFAULT_KDS_MAP[key] ?? true;

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Pedidos ao Vivo · Zero Tempo" }] }),
  component: OrdersKanban,
});

const PLATFORM_BORDER: Record<string, string> = {
  "99food": "#FFD700",
  ifood: "#EA1D2C",
  keeta: "#00C853",
};
const PLATFORM_LABEL: Record<string, string> = {
  "99food": "99FOOD",
  ifood: "IFOOD",
  keeta: "KEETA",
};

function legacyStageFromStatus(status: string): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "100" || s === "pending" || s === "new") return "new";
  if (s === "confirmed") return "preparing";
  if (s === "ready") return "ready";
  if (s === "dispatched") return "dispatched";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "delivered";
}

const COLUMN_STYLE: Record<string, { bg: string; text: string; emoji: string }> = {
  new:        { bg: "#F59E0B", text: "#1a1a1a", emoji: "🟡" },
  preparing:  { bg: "#F97316", text: "#1a1a1a", emoji: "🟠" },
  ready:      { bg: "#2196F3", text: "#0b1e2f", emoji: "🍽️" },
  dispatched: { bg: "#8B5CF6", text: "#1a1033", emoji: "🛵" },
  delivered:  { bg: "#10B981", text: "#052e1b", emoji: "✅" },
  cancelled:  { bg: "#DC2626", text: "#fff",     emoji: "❌" },
  pendente:   { bg: "#F59E0B", text: "#1a1a1a", emoji: "🟡" },
  aguardando: { bg: "#F97316", text: "#1a1a1a", emoji: "🟠" },
  entregando: { bg: "#8B5CF6", text: "#1a1033", emoji: "🛵" },
};
function styleFor(key: string) {
  return COLUMN_STYLE[key] ?? { bg: "#64748B", text: "#fff", emoji: "📋" };
}

function shortOrderId(s: string): string {
  const clean = String(s ?? "");
  return clean.length > 8 ? clean.slice(-8) : clean;
}

const centsToBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function minutesSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function formatElapsed(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "--:--";
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 3600) {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }
  return `há ${Math.floor(s / 60)} min`;
}

function formatSignedMMSS(totalSec: number): string {
  const abs = Math.abs(totalSec);
  const mm = String(Math.floor(abs / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatHHmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function playBeep() {
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
  } catch {
    /* ignore */
  }
}

function OrdersKanban() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refuseTarget, setRefuseTarget] = useState<ApiOrder | null>(null);
  const [kdsCfg, setKdsCfg] = useState<KdsFieldMap>(DEFAULT_KDS_MAP);
  const [columns, setColumns] = useState<KdsColumn[]>(DEFAULT_KDS_COLUMNS);
  const [configOpen, setConfigOpen] = useState(false);
  const todayStr = () => {
    const d = new Date();
    const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return tz.toISOString().slice(0, 10);
  };
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [storeFilter, setStoreFilter] = useState<string>("__all__");
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await getAllOrders(["99food", "ifood"], selectedDate);
      setOrders(data);
      const ids = new Set(data.map((o) => o.id));
      if (!firstLoad.current) {
        for (const id of ids) {
          if (!seenIds.current.has(id)) {
            playBeep();
            break;
          }
        }
      }
      seenIds.current = ids;
      firstLoad.current = false;
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    firstLoad.current = true;
    load();
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer != null) return;
      timer = setInterval(() => {
        if (!document.hidden) load();
      }, 10000);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        load();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    let alive = true;
    getKdsSettings().then((r) => {
      if (!alive) return;
      setKdsCfg(r.config.fields);
      setColumns(r.config.columns);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { renderColumns, grouped } = useMemo(() => {
    const visible = [...columns]
      .filter((c) => c.visible)
      .sort((a, b) => a.order - b.order);
    const g: Record<string, ApiOrder[]> = {};
    for (const c of visible) g[c.key] = [];
    const filtered = orders.filter((o) => {
      if (storeFilter === "__all__") return true;
      const name = (o.store_name && o.store_name.trim()) || "__unknown__";
      return name === storeFilter;
    });
    for (const o of filtered) {
      const stage = String(o.kds_stage ?? legacyStageFromStatus(o.status));
      if (g[stage]) {
        g[stage].push(o);
      } else if (g["pendente"]) {
        // stage sem coluna correspondente → cai em "pendente"
        g["pendente"].push(o);
      }
      // se não há coluna "pendente" visível, o pedido simplesmente não aparece
    }
    return { renderColumns: visible, grouped: g };
  }, [orders, columns, storeFilter]);
  const visibleColumns = renderColumns;

  const storeOptions = useMemo(() => {
    const set = new Set<string>();
    let hasUnknown = false;
    for (const o of orders) {
      const n = (o.store_name && o.store_name.trim()) || "";
      if (n) set.add(n);
      else hasUnknown = true;
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { names: arr, hasUnknown };
  }, [orders]);

  const totalFiltered = useMemo(() => {
    if (storeFilter === "__all__") return orders.length;
    return orders.filter((o) => {
      const name = (o.store_name && o.store_name.trim()) || "__unknown__";
      return name === storeFilter;
    }).length;
  }, [orders, storeFilter]);

  const handleAccept = async (order: ApiOrder) => {
    setBusyId(order.id);
    try {
      await confirmOrder(
        order.platform_order_id,
        order.app_shop_id ?? "",
        order.platform,
      );
      toast.success(`Pedido #${shortOrderId(order.platform_order_id || order.id)} aceito!`);
      await load();
    } catch {
      toast.error("Erro ao aceitar pedido. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReady = async (order: ApiOrder) => {
    setBusyId(order.id);
    try {
      const res = await readyOrder(order.platform, order.platform_order_id || order.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "ready" } : o)),
      );
      toast.success(`Pedido #${shortOrderId(order.platform_order_id || order.id)} finalizado!`);
      if (res.platform_synced === false) {
        toast.warning(res.warning || "Pedido avançou no painel, mas não foi sincronizado com a plataforma.");
      }
      await load();
    } catch {
      toast.error("Erro ao finalizar pedido. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDispatch = async (order: ApiOrder) => {
    setBusyId(order.id);
    try {
      await dispatchOrder(order.platform, order.platform_order_id || order.id);
      toast.success(`Pedido #${shortOrderId(order.platform_order_id || order.id)} saiu para entrega!`);
      await load();
    } catch {
      toast.error("Erro ao despachar pedido. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRefuseConfirm = async () => {
    const order = refuseTarget;
    if (!order) return;
    setBusyId(order.id);
    try {
      await cancelOrder(
        order.platform_order_id,
        order.app_shop_id ?? "",
        order.platform,
      );
      toast.success(`Pedido #${shortOrderId(order.platform_order_id || order.id)} recusado`);
      setRefuseTarget(null);
      await load();
    } catch {
      toast.error("Erro ao recusar pedido. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-foreground">Pedidos ao Vivo</h1>
          <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">
            {totalFiltered}
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => setSelectedDate(todayStr())}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Hoje
          </button>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:border-primary focus:outline-none max-w-[220px]"
            aria-label="Filtrar por loja"
          >
            <option value="__all__">Todas as lojas</option>
            {storeOptions.names.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            {storeOptions.hasUnknown && (
              <option value="__unknown__">Loja não identificada</option>
            )}
          </select>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xl font-bold tabular-nums text-muted-foreground">
            {now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </span>
          <button
            onClick={() => setConfigOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm font-bold text-foreground hover:bg-muted/70"
          >
            <Settings2 className="h-4 w-4" />
            Configurar colunas
          </button>
          <button
            onClick={load}
            className="rounded-lg bg-muted p-2 text-foreground hover:bg-muted/70"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {visibleColumns.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma coluna visível. Clique em <strong>Configurar colunas</strong> para habilitar.
        </div>
      ) : (
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(280px, 1fr))` }}
        >
          {visibleColumns.map((col) => {
            const s = styleFor(col.key);
            return (
              <Column
                key={col.key}
                col={{ key: col.key, title: col.label.toUpperCase(), headerBg: s.bg, headerText: s.text, emoji: s.emoji }}
                orders={grouped[col.key] ?? []}
                now={now}
                busyId={busyId}
                kdsCfg={kdsCfg}
                onAccept={handleAccept}
                onReady={handleReady}
                onDispatch={handleDispatch}
                onRefuse={(o) => setRefuseTarget(o)}
                onRefresh={load}
                onOrderUpdated={(updated) =>
                  setOrders((prev) =>
                    prev.map((o) =>
                      o.platform === updated.platform &&
                      o.platform_order_id === updated.platform_order_id
                        ? { ...o, ...updated }
                        : o,
                    ),
                  )
                }
              />
            );
          })}
        </div>
      )}

      <ColumnsConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        columns={columns}
        onSaved={(next) => {
          setColumns(next);
          setConfigOpen(false);
        }}
        onReset={(nextCols, nextFields) => {
          setColumns(nextCols);
          if (nextFields) setKdsCfg(nextFields);
          load();
        }}
      />

      <AlertDialog open={!!refuseTarget} onOpenChange={(open) => !open && setRefuseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja recusar o pedido #
              {refuseTarget
                ? shortOrderId(refuseTarget.platform_order_id || refuseTarget.id)
                : ""}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === refuseTarget?.id}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRefuseConfirm();
              }}
              disabled={busyId === refuseTarget?.id}
              className="bg-[#DC2626] hover:bg-[#DC2626]/90"
            >
              {busyId === refuseTarget?.id ? "Aguarde..." : "Confirmar recusa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Column({
  col,
  orders,
  now,
  busyId,
  kdsCfg,
  onAccept,
  onReady,
  onDispatch,
  onRefuse,
  onRefresh,
  onOrderUpdated,
}: {
  col: { key: string; title: string; headerBg: string; headerText: string; emoji: string };
  orders: ApiOrder[];
  now: Date;
  busyId: string | null;
  kdsCfg: KdsFieldMap;
  onAccept: (o: ApiOrder) => void;
  onReady: (o: ApiOrder) => void;
  onDispatch: (o: ApiOrder) => void;
  onRefuse: (o: ApiOrder) => void;
  onRefresh: () => void | Promise<void>;
  onOrderUpdated: (updated: ApiOrder) => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-col rounded-2xl border bg-muted/40 p-3 shadow-sm"
      style={{ maxHeight: "calc(100vh - 8rem)" }}
    >
      <div
        className="mb-3 flex items-center justify-between px-4 py-3"
        style={{ background: col.headerBg, color: col.headerText, borderRadius: 12 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{col.emoji}</span>
          <h2 className="text-base font-black tracking-widest">{col.title}</h2>
        </div>
        <span
          className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold"
          style={{ color: col.headerText }}
        >
          {orders.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ rowGap: 12 }}>
        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum pedido
          </div>
        ) : (
          orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              colKey={col.key}
              now={now}
              busy={busyId === o.id}
              kdsCfg={kdsCfg}
              onAccept={onAccept}
              onReady={onReady}
              onDispatch={onDispatch}
              onRefuse={onRefuse}
              onRefresh={onRefresh}
              onOrderUpdated={onOrderUpdated}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  colKey,
  now,
  busy,
  kdsCfg,
  onAccept,
  onReady,
  onDispatch,
  onRefuse,
  onRefresh,
  onOrderUpdated,
}: {
  order: ApiOrder;
  colKey: string;
  now: Date;
  busy: boolean;
  kdsCfg: KdsFieldMap;
  onAccept: (o: ApiOrder) => void;
  onReady: (o: ApiOrder) => void;
  onDispatch: (o: ApiOrder) => void;
  onRefuse: (o: ApiOrder) => void;
  onRefresh: () => void | Promise<void>;
  onOrderUpdated: (updated: ApiOrder) => void;
}) {
  void colKey;
  const nowMs = now.getTime();
  const mins = minutesSince(order.created_at);
  const urgent = mins > 20;
  const elapsedText = formatElapsed(order.created_at, nowMs);
  const promiseEpochMs =
    typeof order.promise_epoch === "number"
      ? (order.promise_epoch > 1e12 ? order.promise_epoch : order.promise_epoch * 1000)
      : null;
  const promiseDiffSec =
    promiseEpochMs != null ? Math.floor((promiseEpochMs - nowMs) / 1000) : null;
  const promiseLate = promiseDiffSec != null && promiseDiffSec < 0;
  const border = PLATFORM_BORDER[order.platform] ?? "#888";
  const subtotal = order.items.reduce((acc, it) => {
    const subs = (it.sub_item_list ?? []).reduce((s, si) => s + (si.total_price || 0), 0);
    return acc + (it.total_price || 0) + subs;
  }, 0);
  const [expanded, setExpanded] = useState(false);
  const showSubs = show(kdsCfg, "item_subitems") &&
    order.items.some((it) => (it.sub_item_list ?? []).length > 0);
  const hasDetails = showSubs;
  const typeRaw = String(order.order_type || order.delivery_type || "").toLowerCase();
  const isTakeout = typeRaw.includes("take") || typeRaw.includes("retir");
  const promise =
    order.delivery_promise ||
    order.promise_time ||
    (order.delivery_promise_at ? formatHHmm(order.delivery_promise_at) : null);
  const neighborhood = order.delivery_neighborhood || order.neighborhood || null;
  const note = order.note?.trim() || null;
  const km =
    typeof order.distance_km === "number"
      ? `${order.distance_km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`
      : null;

  return (
    <div
      className="w-full"
      style={{
        background: "var(--card)",
        color: "var(--card-foreground)",
        borderRadius: 16,
        padding: 0,
        overflow: "hidden",
        borderLeft: `6px solid ${border}`,
        boxShadow: urgent
          ? "0 0 0 2px rgba(239,68,68,0.4), 0 4px 12px rgba(0,0,0,0.08)"
          : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="p-4">
      {/* Cabeçalho: nome + selo + distância */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {show(kdsCfg, "platform_badge") && (
              <span
                className="rounded-md px-2 py-1 text-[11px] font-black tracking-wider text-black"
                style={{ background: border }}
              >
                {PLATFORM_LABEL[order.platform] ?? order.platform.toUpperCase()}
              </span>
            )}
            {show(kdsCfg, "customer_name") && (
              <span
                className="truncate font-black"
                style={{ fontSize: 20, lineHeight: 1.15 }}
              >
                {order.customer_name ?? "Cliente"}
              </span>
            )}
          </div>
          {show(kdsCfg, "order_number") && (
            <div
              className="mt-2 font-black tabular-nums"
              style={{ fontSize: 24, color: "#B45309", letterSpacing: 1 }}
            >
              #{order.order_number || order.platform_order_id}
            </div>
          )}
          {show(kdsCfg, "customer_phone") && order.customer_phone && (
            <div className="mt-1 text-sm text-muted-foreground">
              📞 {order.customer_phone}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          {km && (
            <div
              className="inline-block rounded-md px-2 py-0.5 text-xs font-black"
              style={{ background: "var(--muted)", color: "var(--foreground)" }}
            >
              {km}
            </div>
          )}
          {show(kdsCfg, "order_time") && (
            <div
              className="mt-1 font-mono font-black tabular-nums"
              style={{ fontSize: 22, lineHeight: 1 }}
            >
              {formatHHmm(order.created_at)}
            </div>
          )}
          {show(kdsCfg, "order_elapsed") && (
            <div
              className="mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-black tabular-nums"
              style={{
                color: urgent ? "#fff" : "var(--foreground)",
                background: urgent ? "#DC2626" : "var(--muted)",
              }}
              title="Tempo decorrido desde o pedido"
            >
              {elapsedText}
            </div>
          )}
          {promiseDiffSec != null && (
            <div
              className="mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-black tabular-nums"
              style={{
                color: "#fff",
                background: promiseLate ? "#DC2626" : "#0F172A",
              }}
              title="Contagem até a promessa"
            >
              {promiseLate ? "atrasado " : "faltam "}
              {formatSignedMMSS(promiseDiffSec)}
            </div>
          )}
        </div>
      </div>

      {/* Nome da loja */}
      <div className="mt-3 flex items-center gap-2 text-sm font-bold text-foreground/80">
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">
          {order.store_name?.trim() || "Loja não identificada"}
        </span>
      </div>

      {/* Itens grandes */}
      <div className="mt-4 space-y-3 rounded-xl bg-muted/60 p-3">
        {order.items.map((it, idx) => (
          <ItemRow
            key={idx}
            item={it}
            showSubs={expanded && show(kdsCfg, "item_subitems")}
            kdsCfg={kdsCfg}
          />
        ))}
      </div>

      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> ver complementos
            </>
          )}
        </button>
      )}

      {/* Bloco abaixo dos itens: promessa, tipo, endereço, observação */}
      <div className="mt-4 space-y-2 pt-3" style={{ borderTop: "1px dashed var(--border)" }}>
        {promise && (
          <div
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black"
            style={{ background: "#FEF3C7", color: "#78350F" }}
          >
            <span>⏱</span>
            <span className="uppercase tracking-wider">Promessa:</span>
            <span className="tabular-nums">{promise}</span>
          </div>
        )}
        {(order.order_type || order.delivery_type) && (
          <div>
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: isTakeout ? "#7C3AED" : "#2563EB",
                color: "#fff",
              }}
            >
              {order.order_type || order.delivery_type}
            </span>
          </div>
        )}
        {order.delivery_address && (
          <div className="flex items-start gap-1.5 text-sm leading-snug">
            <span className="mt-0.5">📍</span>
            <div className="min-w-0">
              <div className="font-bold text-foreground break-words">
                {order.delivery_address}
              </div>
              {neighborhood && (
                <div className="text-muted-foreground">{neighborhood}</div>
              )}
            </div>
          </div>
        )}
        {note && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: "#FEF3C7",
              color: "#78350F",
              border: "1px solid #FCD34D",
            }}
          >
            <span className="mr-1 font-black">📝 Obs:</span>
            <span className="font-semibold">{note}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-sm">
          <Bike className="h-4 w-4 text-muted-foreground" />
          {order.courier_name && order.courier_name.trim() ? (
            <span className="font-bold text-foreground">
              Entregador: {order.courier_name}
            </span>
          ) : (
            <span className="font-semibold text-muted-foreground">
              Aguardando entregador
            </span>
          )}
        </div>
        {order.pickup_code && String(order.pickup_code).trim() && (
          <div
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black"
            style={{ background: "#DBEAFE", color: "#1E3A8A" }}
          >
            <span>🔑</span>
            <span className="uppercase tracking-wider">Coleta:</span>
            <span className="tabular-nums">{order.pickup_code}</span>
          </div>
        )}
      </div>

      {/* Total */}
      {show(kdsCfg, "total_price") && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Total
          </span>
          <span className="font-black tabular-nums" style={{ fontSize: 22, color: "#16A34A" }}>
            {centsToBRL(subtotal)}
          </span>
        </div>
      )}
      </div>

      {/* Faixa/etiqueta de pagamento */}
      {show(kdsCfg, "payment_method") && order.payment_method && (
        <div
          className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-black"
          style={{ background: "#0F172A", color: "#F8FAFC" }}
        >
          <span className="flex items-center gap-2">
            <span>💳</span>
            <span className="uppercase tracking-wider">{order.payment_method}</span>
          </span>
          {order.payment_when && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-wider"
              style={{ background: "#F59E0B", color: "#1a1a1a" }}
            >
              {order.payment_when}
            </span>
          )}
        </div>
      )}

      <StageActions
        order={order}
        busy={busy}
        onRefuse={onRefuse}
        onOrderUpdated={onOrderUpdated}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function StageActions({
  order,
  busy,
  onRefuse,
  onOrderUpdated,
  onRefresh,
}: {
  order: ApiOrder;
  busy: boolean;
  onRefuse: (o: ApiOrder) => void;
  onOrderUpdated: (updated: ApiOrder) => void;
  onRefresh: () => void | Promise<void>;
}) {
  const actions = Array.isArray(order.available_actions) ? order.available_actions : [];
  const [busySet, setBusySet] = useState<Set<string>>(new Set());
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const orderKey = order.platform_order_id;
  const orderBusy = busy || busySet.has(orderKey);

  if (actions.length === 0) return null;

  const styleFor = (action: string): { bg: string; icon: React.ReactNode } => {
    switch (action) {
      case "confirm": return { bg: "#16A34A", icon: <Check className="h-4 w-4" /> };
      case "ready":   return { bg: "#2196F3", icon: <ChefHat className="h-4 w-4" /> };
      case "dispatch":return { bg: "#8B5CF6", icon: <Bike className="h-4 w-4" /> };
      case "cancel":  return { bg: "#DC2626", icon: <X className="h-4 w-4" /> };
      default:        return { bg: "#475569", icon: null };
    }
  };

  const runAction = async (action: string) => {
    // Anti-duplo-clique por pedido: ignora se o mesmo pedido já está em ação.
    if (busySet.has(orderKey)) return;
    // "cancel" passa pelo modal de confirmação (sem POST direto aqui)
    if (action === "cancel") {
      onRefuse(order);
      return;
    }
    setBusySet((prev) => {
      const next = new Set(prev);
      next.add(orderKey);
      return next;
    });
    setRunningAction(action);
    try {
      const res = await runOrderAction(order.platform, order.platform_order_id, action);
      if (!res.ok) {
        toast.error(res.details || res.error || "Falha na ação");
        return;
      }
      // Atualiza SÓ este card (anti-flicker).
      onOrderUpdated({
        ...order,
        status: res.order.status,
        kds_stage: res.order.kds_stage,
        available_actions: res.order.available_actions as ApiOrder["available_actions"],
      });
      if (res.warning) toast.info(res.warning);
      // Reconciliação em background — não bloqueia a UI.
      void Promise.resolve(onRefresh()).catch(() => undefined);
    } finally {
      setRunningAction(null);
      setBusySet((prev) => {
        const next = new Set(prev);
        next.delete(orderKey);
        return next;
      });
    }
  };

  const cols = Math.min(actions.length, 2);

  return (
    <div
      className="grid gap-2 p-4 pt-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {actions.map((a) => {
        const s = styleFor(a.action);
        const isRunning = orderBusy && runningAction === a.action;
        return (
          <button
            key={a.action}
            onClick={() => runAction(a.action)}
            disabled={orderBusy}
            className="flex w-full items-center justify-center gap-1 text-white transition hover:opacity-90 disabled:cursor-not-allowed"
            style={{
              background: s.bg,
              height: 40,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              opacity: orderBusy ? 0.7 : 1,
            }}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> AGUARDE...
              </>
            ) : (
              <>
                {s.icon} <span className="uppercase tracking-wider">{a.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ItemRow({ item, showSubs, kdsCfg }: { item: OrderItem; showSubs: boolean; kdsCfg: KdsFieldMap }) {
  const [broken, setBroken] = useState(false);
  const showImage = show(kdsCfg, "item_image");
  const showName = show(kdsCfg, "item_name");
  const showQty = show(kdsCfg, "item_quantity");
  const showPrice = show(kdsCfg, "item_price");
  const hasImg = showImage && !!item.image && !broken;
  return (
    <div>
      <div className="flex items-center gap-3">
        {showQty && (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg font-black tabular-nums"
            style={{
              background: "#FBBF24",
              color: "#1a1a1a",
              fontSize: 26,
              lineHeight: 1,
            }}
          >
            {String(item.amount).padStart(2, "0")}
          </div>
        )}
        {showImage && (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
          >
            {hasImg ? (
              <img
                src={item.image as string}
                alt={item.name}
                className="h-full w-full object-cover"
                onError={() => setBroken(true)}
                loading="lazy"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {showName && (
            <div
              className="font-black leading-tight"
              style={{ fontSize: 17 }}
            >
              {item.name}
            </div>
          )}
        </div>
        {showPrice && item.total_price > 0 && (
          <div className="shrink-0 text-sm font-black tabular-nums" style={{ color: "#16A34A" }}>
            {centsToBRL(item.total_price)}
          </div>
        )}
      </div>
      {showSubs && item.sub_item_list && item.sub_item_list.length > 0 && (
        <ul className="mt-2 space-y-1" style={{ marginLeft: 68 }}>
          {item.sub_item_list.map((s, i) => (
            <SubItem key={i} sub={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubItem({ sub }: { sub: OrderSubItem }) {
  const price = sub.total_price || 0;
  return (
    <li className="flex justify-between text-muted-foreground" style={{ fontSize: 13 }}>
      <span>
        <span className="text-muted-foreground/60">•</span> {sub.name}
      </span>
      {price > 0 && (
        <span className="font-bold" style={{ color: "#16A34A" }}>
          +{centsToBRL(price)}
        </span>
      )}
    </li>
  );
}

function ColumnsConfigDialog({
  open,
  onOpenChange,
  columns,
  onSaved,
  onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: KdsColumn[];
  onSaved: (next: KdsColumn[]) => void;
  onReset: (nextCols: KdsColumn[], nextFields?: Record<string, boolean>) => void;
}) {
  const [draft, setDraft] = useState<KdsColumn[]>(columns);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const cols = await fetchKdsColumnsStrict();
      setDraft(cols.map((c, i) => ({ ...c, order: i })));
    } catch {
      setLoadError("Não foi possível carregar as colunas.");
      // ainda assim mostra a última cópia conhecida para o usuário poder tentar de novo
      setDraft(columns.map((c) => ({ ...c })));
    } finally {
      setLoading(false);
    }
  }, [columns]);

  useEffect(() => {
    if (open) {
      setSaveError(null);
      loadConfig();
    }
  }, [open, loadConfig]);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= draft.length) return;
    const next = [...draft];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setDraft(next.map((c, i) => ({ ...c, order: i })));
  };

  const toggle = (idx: number, visible: boolean) => {
    setDraft((prev) => prev.map((c, i) => (i === idx ? { ...c, visible } : c)));
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // garante order sequencial e único (1..N na ordem da lista)
      const ordered = draft.map((c, i) => ({ ...c, order: i + 1 }));
      await updateKdsColumns(ordered);
      toast.success("Colunas atualizadas");
      // devolve com order 0-based para consistência interna de sort
      onSaved(ordered.map((c, i) => ({ ...c, order: i })));
    } catch {
      setSaveError("Não foi possível salvar. Suas edições foram mantidas — tente novamente.");
      toast.error("Não foi possível salvar as colunas");
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    setResetting(true);
    setSaveError(null);
    try {
      const resp = await resetKdsSettings();
      const cols = resp.config.columns.map((c, i) => ({ ...c, order: i }));
      setDraft(cols);
      toast.success("Colunas restauradas ao padrão");
      onReset(cols, resp.config.fields);
      setConfirmResetOpen(false);
      onOpenChange(false);
    } catch {
      setSaveError("Não foi possível restaurar o padrão. Tente novamente.");
      toast.error("Não foi possível restaurar o padrão");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar colunas do KDS</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Desligue colunas que você não quer ver e arraste para reordenar. O número mostra a ordem em que a coluna vai aparecer.
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando colunas...
          </div>
        ) : loadError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="mb-3 text-destructive">{loadError}</p>
            <Button size="sm" variant="outline" onClick={loadConfig}>
              Tentar de novo
            </Button>
          </div>
        ) : (
        <ul className="mt-2 space-y-1">
          {draft.map((c, idx) => (
            <li
              key={c.key}
              draggable
              onDragStart={() => (dragIdx.current = idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx.current !== null) move(dragIdx.current, idx);
                dragIdx.current = null;
              }}
              className="flex items-center gap-2 rounded-md border bg-background px-2 py-2"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black tabular-nums text-primary"
                aria-label={`Posição ${idx + 1}`}
              >
                {idx + 1}
              </span>
              <Checkbox
                checked={c.visible}
                onCheckedChange={(v) => toggle(idx, v === true)}
                aria-label={`Mostrar ${c.label}`}
              />
              <span className="flex-1 truncate text-sm font-medium">{c.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{c.key}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, idx - 1)}
                  disabled={idx === 0}
                  className="rounded border px-1 text-xs disabled:opacity-30"
                  aria-label="Mover para cima"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, idx + 1)}
                  disabled={idx === draft.length - 1}
                  className="rounded border px-1 text-xs disabled:opacity-30"
                  aria-label="Mover para baixo"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
        )}

        {saveError && (
          <p className="text-sm text-destructive" role="alert">{saveError}</p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setConfirmResetOpen(true)}
            disabled={saving || resetting || loading}
            className="mr-auto"
          >
            {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {resetting ? "Restaurando..." : "Restaurar padrão"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || resetting}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || resetting || loading || !!loadError}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
        <AlertDialog open={confirmResetOpen} onOpenChange={(v) => !resetting && setConfirmResetOpen(v)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restaurar colunas ao padrão?</AlertDialogTitle>
              <AlertDialogDescription>
                Isto vai voltar as colunas ao padrão. Continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  doReset();
                }}
                disabled={resetting}
              >
                {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {resetting ? "Restaurando..." : "Continuar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}