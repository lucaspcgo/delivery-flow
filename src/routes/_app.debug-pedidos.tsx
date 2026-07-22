import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { http } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { getAdminUsers, type AdminUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Copy, RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/debug-pedidos")({
  component: DebugPedidosPage,
});

type Platform = "99food" | "ifood";

type CheckStatus = "ok" | "divergente" | "vazio" | "sem_origem";

interface FieldCheck {
  field: string;
  mapped?: unknown;
  raw?: unknown;
  source?: string | null;
  status: CheckStatus;
}

interface DebugOrder {
  platform_order_id?: string | null;
  app_shop_id?: string | null;
  status?: string | null;
  kds_stage?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  mapped?: Record<string, unknown> | null;
  raw?: unknown;
  raw_keys?: string[] | null;
  field_checks?: FieldCheck[] | null;
}

interface DebugResponse {
  platform: string;
  count: number;
  orders: DebugOrder[];
  total?: number;
  has_more?: boolean;
  next_offset?: number | null;
  offset?: number;
  limit?: number;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function renderScalar(v: unknown) {
  if (isEmpty(v)) return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return <span>{v ? "true" : "false"}</span>;
  if (typeof v === "number" || typeof v === "string") return <span>{String(v)}</span>;
  return (
    <pre className="whitespace-pre-wrap break-all rounded bg-muted/60 p-2 text-xs">
      {JSON.stringify(v, null, 2)}
    </pre>
  );
}

function MappedItems({ items }: { items: unknown }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <ul className="space-y-2">
      {items.map((it, idx) => {
        const item = (it ?? {}) as Record<string, unknown>;
        const name = (item.name as string | undefined) ?? "(sem nome)";
        const amount = item.amount ?? item.quantity ?? item.qty;
        const image = item.image as string | undefined | null;
        return (
          <li key={idx} className="flex items-center gap-3 rounded border bg-background p-2">
            {image ? (
              <img
                src={image}
                alt={name}
                className="h-12 w-12 shrink-0 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                sem foto
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">
                Qtd: {amount === undefined || amount === null ? "—" : String(amount)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MappedBlock({ mapped }: { mapped: Record<string, unknown> | null | undefined }) {
  if (!mapped || typeof mapped !== "object") {
    return <p className="text-sm text-muted-foreground">Sem dados mapeados.</p>;
  }
  const entries = Object.entries(mapped);
  return (
    <dl className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(120px,180px)_1fr] gap-2 border-b pb-2 last:border-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {key}
          </dt>
          <dd className="min-w-0 break-words text-sm">
            {key === "items" ? <MappedItems items={value} /> : renderScalar(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const STATUS_META: Record<CheckStatus, { row: string; badge: string; label: string }> = {
  divergente: {
    row: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-800 border-red-300",
    label: "Divergente",
  },
  vazio: {
    row: "bg-yellow-50 border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-300",
    label: "Dado perdido",
  },
  sem_origem: {
    row: "bg-gray-50 border-gray-200",
    badge: "bg-gray-100 text-gray-700 border-gray-300",
    label: "Não veio da plataforma",
  },
  ok: {
    row: "bg-green-50/40 border-green-100",
    badge: "bg-green-100 text-green-800 border-green-300",
    label: "OK",
  },
};

function FieldChecksTable({ checks }: { checks: FieldCheck[] }) {
  if (!checks || checks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem verificações de campo.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-2">Campo</th>
            <th className="px-2 py-2">Mapeado</th>
            <th className="px-2 py-2">Bruto</th>
            <th className="px-2 py-2">Origem</th>
            <th className="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c, idx) => {
            const meta = STATUS_META[c.status] ?? STATUS_META.ok;
            return (
              <tr key={`${c.field}-${idx}`} className={`border-b ${meta.row}`}>
                <td className="px-2 py-2 align-top font-mono text-xs font-semibold">{c.field}</td>
                <td className="px-2 py-2 align-top">{renderScalar(c.mapped)}</td>
                <td className="px-2 py-2 align-top">{renderScalar(c.raw)}</td>
                <td className="px-2 py-2 align-top font-mono text-xs text-muted-foreground">
                  {c.source ?? "—"}
                </td>
                <td className="px-2 py-2 align-top">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                    {meta.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DebugCard({ order }: { order: DebugOrder }) {
  const rawJson = (() => {
    try {
      return JSON.stringify(order.raw ?? {}, null, 2);
    } catch {
      return String(order.raw);
    }
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      toast.success("JSON copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Card className="bg-background">
      <CardHeader className="flex flex-col gap-2 border-b sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              ID do pedido
            </div>
            <div className="font-mono text-base font-semibold">
              {order.platform_order_id ?? "—"}
            </div>
          </div>
          <Badge variant="secondary" className="uppercase">
            {order.status ?? "—"}
          </Badge>
          {order.kds_stage && (
            <Badge variant="outline" className="uppercase">
              KDS: {order.kds_stage}
            </Badge>
          )}
          {order.app_shop_id && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Loja
              </div>
              <div className="font-mono text-xs font-semibold">{order.app_shop_id}</div>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            <div>Recebido em: {formatDateTime(order.created_at)}</div>
            <div>Atualizado em: {formatDateTime(order.updated_at)}</div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar JSON
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        {order.field_checks && order.field_checks.length > 0 && (
          <section className="mb-4 min-w-0">
            <h3 className="mb-3 text-sm font-semibold">
              Verificação campo a campo
            </h3>
            <FieldChecksTable checks={order.field_checks} />
          </section>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="min-w-0">
            <h3 className="mb-3 text-sm font-semibold">
              Mapeado <span className="text-muted-foreground">(o que o KDS usa)</span>
            </h3>
            <MappedBlock mapped={order.mapped ?? null} />
          </section>
          <section className="min-w-0">
            <h3 className="mb-3 text-sm font-semibold">
              Bruto <span className="text-muted-foreground">(recebido da plataforma)</span>
            </h3>
            {order.raw_keys && order.raw_keys.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {order.raw_keys.map((k) => (
                  <span
                    key={k}
                    className="rounded-full border bg-muted px-2 py-0.5 font-mono text-[11px]"
                  >
                    {k}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-2 text-xs text-muted-foreground">Sem raw_keys.</p>
            )}
            <pre className="max-h-[420px] overflow-auto rounded border bg-muted/50 p-3 text-xs leading-relaxed">
              {rawJson}
            </pre>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function DebugPedidosPage() {
  const navigate = useNavigate();
  const user = getUser() as { is_admin?: boolean } | null;
  const isAdmin = user?.is_admin === true;
  useEffect(() => {
    if (!isAdmin) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [isAdmin, navigate]);
  const [platform, setPlatform] = useState<Platform>("99food");
  const [limit, setLimit] = useState<number>(10);
  const [userId, setUserId] = useState<string>("");
  const [store, setStore] = useState<string>("");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<DebugOrder[]>([]);
  const [meta, setMeta] = useState<{
    platform: string;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (opts: { platform: Platform; limit: number; offset: number; append: boolean }) => {
      const { platform: pf, limit: lm, offset, append } = opts;
      if (append) setIsFetchingMore(true);
      else setIsLoading(true);
      setError(null);
      try {
        const query: Record<string, string | number> = { limit: lm, offset };
        if (userId) query.user_id = userId;
        if (store.trim()) query.store = store.trim();
        const data = await http.get<DebugResponse>(`/webhooks/${pf}/debug`, {
          query,
          silent: true,
        });
        const next = data.orders ?? [];
        setOrders((prev) => (append ? [...prev, ...next] : next));
        setMeta({
          platform: data.platform ?? pf,
          total: typeof data.total === "number" ? data.total : (append ? (meta?.total ?? 0) : next.length),
          hasMore: data.has_more === true,
          nextOffset: typeof data.next_offset === "number" ? data.next_offset : null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "erro desconhecido");
      } finally {
        setIsLoading(false);
        setIsFetchingMore(false);
      }
    },
    [meta?.total, userId, store],
  );

  useEffect(() => {
    if (isAdmin) {
      fetchPage({ platform: "99food", limit: 10, offset: 0, append: false });
      getAdminUsers()
        .then((u) => setAdminUsers(u))
        .catch(() => {
          /* silencioso */
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Redirecionando…</div>
    );
  }

  const clampedLimit = () => Math.max(1, Math.min(50, Math.floor(limit || 1)));

  const apply = () => {
    const lm = clampedLimit();
    setLimit(lm);
    setOrders([]);
    setMeta(null);
    fetchPage({ platform, limit: lm, offset: 0, append: false });
  };

  const loadMore = () => {
    if (!meta || !meta.hasMore || meta.nextOffset === null) return;
    fetchPage({ platform, limit: clampedLimit(), offset: meta.nextOffset, append: true });
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader
        title="Depuração de Pedidos"
        description="Compare os dados brutos recebidos da plataforma com os dados mapeados pelo KDS."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Plataforma</label>
            <div className="inline-flex rounded-md border bg-muted p-1">
              {(["99food", "ifood"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    platform === p
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "99food" ? "99Food" : "iFood"}
                </button>
              ))}
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label htmlFor="debug-user" className="text-xs font-medium text-muted-foreground">
                Usuário
              </label>
              <select
                id="debug-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Todos os usuários</option>
                {adminUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <label htmlFor="debug-store" className="text-xs font-medium text-muted-foreground">
                Loja (app_shop_id)
              </label>
              <Input
                id="debug-store"
                type="text"
                value={store}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Todas"
                className="w-48"
                list="debug-store-options"
              />
              <datalist id="debug-store-options">
                {Array.from(
                  new Set(orders.map((o) => o.app_shop_id).filter(Boolean) as string[]),
                ).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="debug-limit" className="text-xs font-medium text-muted-foreground">
              Quantidade (máx. 50)
            </label>
            <Input
              id="debug-limit"
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <Button onClick={apply} disabled={isLoading || isFetchingMore}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
          {meta && (
            <div className="ml-auto text-sm text-muted-foreground">
              {orders.length} de {meta.total} · plataforma <strong>{meta.platform}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando pedidos…
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Não foi possível carregar os pedidos: {error}.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum pedido retornado para os filtros atuais.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {orders.map((o: DebugOrder, idx: number) => (
          <DebugCard key={o.platform_order_id ?? idx} order={o} />
        ))}
      </div>

      {meta?.hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={isFetchingMore}>
            {isFetchingMore ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}