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

const COLUMNS: { key: ColumnKey; title: string; color: string; emoji: string }[] = [
  { key: "new", title: "NOVOS", color: "#FFD700", emoji: "🟡" },
  { key: "preparing", title: "EM PREPARO", color: "#FF8C00", emoji: "🟠" },
  { key: "done", title: "ENTREGUES", color: "#00C853", emoji: "✅" },
];

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
    <div className="-m-6 min-h-[calc(100vh-3.5rem)]" style={{ background: "#0f1117" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4"
        style={{ background: "#0f1117" }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-white">Pedidos ao Vivo</h1>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white">
            {orders.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xl font-bold text-white tabular-nums">
            {now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </span>
          <button
            onClick={load}
            className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="flex gap-4 overflow-x-auto p-4">
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
  col: { key: ColumnKey; title: string; color: string; emoji: string };
  orders: ApiOrder[];
  onMove: (id: string, to: ColumnKey) => void;
  now: Date;
}) {
  return (
    <div className="flex w-[380px] shrink-0 flex-col" style={{ maxHeight: "calc(100vh - 8rem)" }}>
      <div
        className="mb-3 flex items-center justify-between rounded-lg px-4 py-3"
        style={{ background: `${col.color}22`, borderTop: `3px solid ${col.color}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{col.emoji}</span>
          <h2 className="text-sm font-black tracking-wider text-white">{col.title}</h2>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold text-black"
          style={{ background: col.color }}
        >
          {orders.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
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
      className="rounded-lg p-4 shadow-lg"
      style={{ background: "#1a1d27", borderLeft: `4px solid ${border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-black text-black"
            style={{ background: border }}
          >
            {PLATFORM_LABEL[order.platform] ?? order.platform.toUpperCase()}
          </span>
          <span className="text-lg font-black text-white">
            #{order.platform_order_id || order.id.slice(0, 6)}
          </span>
        </div>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: urgent ? "#FF4444" : "#9CA3AF" }}
        >
          há {mins} min
        </span>
      </div>

      <div className="mt-2 font-bold text-white">{order.customer_name ?? "Cliente"}</div>
      {order.app_shop_id && (
        <div className="text-xs text-gray-400">{order.app_shop_id}</div>
      )}

      <div className="mt-3 space-y-2">
        {order.items.map((it, idx) => (
          <ItemRow key={idx} item={it} index={idx + 1} />
        ))}
      </div>

      <div className="mt-3 border-t border-white/5 pt-2 text-right text-base font-black text-white">
        TOTAL {centsToBRL(subtotal)}
      </div>

      {colKey === "new" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onMove(order.id, "preparing")}
            className="flex items-center justify-center gap-1 rounded-md py-2 text-sm font-bold text-white"
            style={{ background: "#00C853" }}
          >
            <Check className="h-4 w-4" /> ACEITAR
          </button>
          <button
            onClick={() => onMove(order.id, "done")}
            className="flex items-center justify-center gap-1 rounded-md py-2 text-sm font-bold text-white"
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
            className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-bold text-white"
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
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white">
          {index}
        </span>
        <div className="flex-1 text-white">
          <span className="font-semibold">{item.name}</span>
          <span className="ml-1 text-gray-400">x{item.amount}</span>
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
    <li className="flex justify-between text-xs text-gray-300">
      <span>• {sub.name}</span>
      {price > 0 && (
        <span className="font-semibold text-yellow-400">+{centsToBRL(price)}</span>
      )}
    </li>
  );
}