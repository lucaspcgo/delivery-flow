import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Check, X, ChefHat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAllOrders, confirmOrder, cancelOrder, readyOrder } from "@/lib/api";
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

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Pedidos ao Vivo · Delivery Auto Pro" }] }),
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

type ColumnKey = "new" | "preparing" | "done";

function columnOf(status: string): ColumnKey {
  const s = String(status ?? "").toLowerCase();
  if (s === "100" || s === "pending" || s === "new") return "new";
  if (s === "confirmed") return "preparing";
  return "done";
}

const COLUMNS: {
  key: ColumnKey;
  title: string;
  accent: string;
  headerBg: string;
  headerText: string;
  emoji: string;
}[] = [
  { key: "new", title: "NOVOS", accent: "#F59E0B", headerBg: "#FFF9C4", headerText: "#92400E", emoji: "🟡" },
  { key: "preparing", title: "EM PREPARO", accent: "#F97316", headerBg: "#FED7AA", headerText: "#92400E", emoji: "🟠" },
  { key: "done", title: "ENTREGUES", accent: "#10B981", headerBg: "#D1FAE5", headerText: "#065F46", emoji: "✅" },
];

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
  const todayStr = () => {
    const d = new Date();
    const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return tz.toISOString().slice(0, 10);
  };
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
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
    const i = setInterval(load, 1000);
    return () => clearInterval(i);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const g: Record<ColumnKey, ApiOrder[]> = { new: [], preparing: [], done: [] };
    for (const o of orders) g[columnOf(o.status)].push(o);
    return g;
  }, [orders]);

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
      await readyOrder(order.platform, order.platform_order_id || order.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "ready" } : o)),
      );
      toast.success(`Pedido #${shortOrderId(order.platform_order_id || order.id)} finalizado!`);
      await load();
    } catch {
      toast.error("Erro ao finalizar pedido. Tente novamente.");
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
    <div className="w-full min-h-[calc(100vh-3.5rem)]" style={{ background: "#F5F5F5" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black" style={{ color: "#1a1a1a" }}>
            Pedidos ao Vivo
          </h1>
          <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">
            {orders.length}
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => setSelectedDate(todayStr())}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xl font-bold tabular-nums" style={{ color: "#6B7280" }}>
            {now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </span>
          <button
            onClick={load}
            className="rounded-lg bg-gray-100 p-2 text-gray-700 hover:bg-gray-200"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            col={col}
            orders={grouped[col.key]}
            now={now}
            busyId={busyId}
            onAccept={handleAccept}
            onReady={handleReady}
            onRefuse={(o) => setRefuseTarget(o)}
          />
        ))}
      </div>

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
  onAccept,
  onReady,
  onRefuse,
}: {
  col: { key: ColumnKey; title: string; accent: string; headerBg: string; headerText: string; emoji: string };
  orders: ApiOrder[];
  now: Date;
  busyId: string | null;
  onAccept: (o: ApiOrder) => void;
  onReady: (o: ApiOrder) => void;
  onRefuse: (o: ApiOrder) => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-col p-3"
      style={{
        maxHeight: "calc(100vh - 8rem)",
        background: "#EFEFEF",
        borderRadius: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div
        className="mb-3 flex items-center justify-between px-4 py-3"
        style={{ background: col.headerBg, color: col.headerText, borderRadius: 12 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{col.emoji}</span>
          <h2 className="text-sm font-black tracking-wider">{col.title}</h2>
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
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
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
              onAccept={onAccept}
              onReady={onReady}
              onRefuse={onRefuse}
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
  onAccept,
  onReady,
  onRefuse,
}: {
  order: ApiOrder;
  colKey: ColumnKey;
  now: Date;
  busy: boolean;
  onAccept: (o: ApiOrder) => void;
  onReady: (o: ApiOrder) => void;
  onRefuse: (o: ApiOrder) => void;
}) {
  void now; // re-render trigger
  const mins = minutesSince(order.created_at);
  const urgent = mins > 20;
  const border = PLATFORM_BORDER[order.platform] ?? "#888";
  const subtotal = order.items.reduce((acc, it) => {
    const subs = (it.sub_item_list ?? []).reduce((s, si) => s + (si.total_price || 0), 0);
    return acc + (it.total_price || 0) + subs;
  }, 0);

  return (
    <div
      className="w-full bg-white"
      style={{
        borderLeft: `4px solid ${border}`,
        color: "#1a1a1a",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-black"
            style={{ background: border }}
          >
            {PLATFORM_LABEL[order.platform] ?? order.platform.toUpperCase()}
          </span>
          <span className="font-bold" style={{ color: "#1a1a1a", fontSize: 18 }}>
            #{shortOrderId(order.platform_order_id || order.id)}
          </span>
        </div>
        <span
          className="font-bold tabular-nums"
          style={{ color: urgent ? "#FF4444" : "#6B7280", fontSize: 13 }}
        >
          há {mins} min
        </span>
      </div>

      <div className="mt-2 font-bold" style={{ color: "#1a1a1a" }}>
        {order.customer_name ?? "Cliente"}
      </div>
      {order.app_shop_id && (
        <div className="text-xs" style={{ color: "#6B7280" }}>
          {order.app_shop_id}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {order.items.map((it, idx) => (
          <ItemRow key={idx} item={it} index={idx + 1} />
        ))}
      </div>

      <div
        className="mt-3 flex items-center justify-between pt-2"
        style={{ color: "#1a1a1a", borderTop: "1px solid #F3F4F6" }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#6B7280" }}>
          Total
        </span>
        <span className="font-bold" style={{ fontSize: 18, color: "#1a1a1a" }}>
          {centsToBRL(subtotal)}
        </span>
      </div>

      {colKey === "new" && (
        <div className="mt-3 grid grid-cols-2" style={{ gap: 8 }}>
          <button
            onClick={() => onAccept(order)}
            disabled={busy}
            className="flex w-full items-center justify-center gap-1 text-white transition hover:opacity-90 disabled:cursor-not-allowed"
            style={{
              background: "#16A34A",
              height: 40,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> AGUARDE...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> ACEITAR
              </>
            )}
          </button>
          <button
            onClick={() => onRefuse(order)}
            disabled={busy}
            className="flex w-full items-center justify-center gap-1 text-white transition hover:opacity-90 disabled:cursor-not-allowed"
            style={{
              background: "#DC2626",
              height: 40,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <X className="h-4 w-4" /> RECUSAR
          </button>
        </div>
      )}
      {colKey === "preparing" && (
        <div className="mt-3">
          <button
            onClick={() => onReady(order)}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed"
            style={{
              background: "#2196F3",
              height: 40,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> AGUARDE...
              </>
            ) : (
              <>
                <ChefHat className="h-4 w-4" /> PRONTO
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, index }: { item: OrderItem; index: number }) {
  return (
    <div className="text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-700">
          {index}
        </span>
        <div className="flex-1 flex items-center gap-2" style={{ color: "#1a1a1a" }}>
          <span className="font-bold" style={{ fontSize: 14 }}>{item.name}</span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
            style={{ background: "#F3F4F6", color: "#6B7280" }}
          >
            x{item.amount}
          </span>
        </div>
      </div>
      {item.sub_item_list && item.sub_item_list.length > 0 && (
        <ul className="ml-7 mt-1 space-y-0.5">
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
    <li className="flex justify-between" style={{ fontSize: 13, color: "#6B7280" }}>
      <span>
        <span style={{ color: "#9CA3AF" }}>•</span> {sub.name}
      </span>
      {price > 0 && (
        <span className="font-semibold" style={{ color: "#16A34A" }}>
          +{centsToBRL(price)}
        </span>
      )}
    </li>
  );
}