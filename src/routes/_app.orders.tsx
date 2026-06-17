import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Check, X, ChefHat } from "lucide-react";
import { getOrders } from "@/lib/api";
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

function columnOf(status: string, override?: Record<string, ColumnKey>): ColumnKey {
  if (override && override[status]) return override[status];
  const s = String(status).toLowerCase();
  if (s === "100" || s === "new") return "new";
  if (s === "confirmed" || s === "200" || s === "preparing") return "preparing";
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
  const [overrides, setOverrides] = useState<Record<string, ColumnKey>>({});
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await getOrders("99food");
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
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 20000);
    return () => clearInterval(i);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const grouped = useMemo(() => {
    const g: Record<ColumnKey, ApiOrder[]> = { new: [], preparing: [], done: [] };
    for (const o of orders) g[columnOf(o.status, overrides)].push(o);
    return g;
  }, [orders, overrides]);

  const move = (id: string, to: ColumnKey) =>
    setOverrides((p) => ({ ...p, [id]: to }));

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)]" style={{ background: "#F5F5F5" }}>
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
          <Column key={col.key} col={col} orders={grouped[col.key]} onMove={move} now={now} />
        ))}
      </div>
    </div>
  );
}

function Column({
  col,
  orders,
  onMove,
  now,
}: {
  col: { key: ColumnKey; title: string; accent: string; headerBg: string; headerText: string; emoji: string };
  orders: ApiOrder[];
  onMove: (id: string, to: ColumnKey) => void;
  now: Date;
}) {
  return (
    <div
      className="flex min-w-0 flex-col rounded-lg p-3"
      style={{ maxHeight: "calc(100vh - 8rem)", background: "#EFEFEF" }}
    >
      <div
        className="mb-3 flex items-center justify-between rounded-lg px-4 py-3"
        style={{ background: col.headerBg, color: col.headerText }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{col.emoji}</span>
          <h2 className="text-sm font-black tracking-wider">{col.title}</h2>
        </div>
        <span
          className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold"
          style={{ color: col.headerText }}
        >
          {orders.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
            Nenhum pedido
          </div>
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} colKey={col.key} onMove={onMove} now={now} />)
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  colKey,
  onMove,
  now,
}: {
  order: ApiOrder;
  colKey: ColumnKey;
  onMove: (id: string, to: ColumnKey) => void;
  now: Date;
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
      className="w-full rounded-lg bg-white p-4 shadow-sm"
      style={{ borderLeft: `4px solid ${border}`, color: "#1a1a1a" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-black text-black"
            style={{ background: border }}
          >
            {PLATFORM_LABEL[order.platform] ?? order.platform.toUpperCase()}
          </span>
          <span className="text-lg font-black" style={{ color: "#1a1a1a" }}>
            #{shortOrderId(order.platform_order_id || order.id)}
          </span>
        </div>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: urgent ? "#FF4444" : "#6B7280" }}
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
        className="mt-3 flex justify-between border-t border-gray-200 pt-2 text-base font-black"
        style={{ color: "#1a1a1a" }}
      >
        <span>TOTAL</span>
        <span>{centsToBRL(subtotal)}</span>
      </div>

      {colKey === "new" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onMove(order.id, "preparing")}
            className="flex w-full items-center justify-center gap-1 rounded-full py-2 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#00C853" }}
          >
            <Check className="h-4 w-4" /> ACEITAR
          </button>
          <button
            onClick={() => onMove(order.id, "done")}
            className="flex w-full items-center justify-center gap-1 rounded-full py-2 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#EA1D2C" }}
          >
            <X className="h-4 w-4" /> RECUSAR
          </button>
        </div>
      )}
      {colKey === "preparing" && (
        <div className="mt-3">
          <button
            onClick={() => onMove(order.id, "done")}
            className="flex w-full items-center justify-center gap-2 rounded-full py-2 text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#2196F3" }}
          >
            <ChefHat className="h-4 w-4" /> PRONTO
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
        <div className="flex-1" style={{ color: "#1a1a1a" }}>
          <span className="font-semibold">{item.name}</span>
          <span className="ml-1" style={{ color: "#6B7280" }}>
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
    <li className="flex justify-between text-xs" style={{ color: "#6B7280" }}>
      <span>• {sub.name}</span>
      {price > 0 && (
        <span className="font-semibold" style={{ color: "#1a1a1a" }}>
          +{centsToBRL(price)}
        </span>
      )}
    </li>
  );
}