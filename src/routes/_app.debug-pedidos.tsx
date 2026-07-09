import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/api";
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

interface DebugOrder {
  platform_order_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  mapped?: Record<string, unknown> | null;
  raw?: unknown;
  raw_keys?: string[] | null;
}

interface DebugResponse {
  platform: string;
  count: number;
  orders: DebugOrder[];
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
          <div className="text-sm text-muted-foreground">
            {formatDateTime(order.created_at)}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar JSON
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
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
  const [platform, setPlatform] = useState<Platform>("99food");
  const [limit, setLimit] = useState<number>(10);
  const [applied, setApplied] = useState<{ platform: Platform; limit: number }>({
    platform: "99food",
    limit: 10,
  });

  const query = useQuery<DebugResponse, Error>({
    queryKey: ["debug-orders", applied.platform, applied.limit],
    queryFn: () =>
      http.get<DebugResponse>(`/orders/${applied.platform}/debug`, {
        query: { limit: applied.limit },
        silent: true,
      }),
  });

  const apply = () => {
    const clamped = Math.max(1, Math.min(50, Math.floor(limit || 1)));
    setLimit(clamped);
    setApplied({ platform, limit: clamped });
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
          <Button onClick={apply} disabled={query.isFetching}>
            {query.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
          {query.data && (
            <div className="ml-auto text-sm text-muted-foreground">
              {query.data.count} pedido(s) · plataforma <strong>{query.data.platform}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {query.isLoading && (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando pedidos…
          </CardContent>
        </Card>
      )}

      {query.isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Não foi possível carregar os pedidos: {query.error?.message ?? "erro desconhecido"}.
          </CardContent>
        </Card>
      )}

      {query.data && query.data.orders.length === 0 && !query.isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhum pedido retornado para os filtros atuais.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {query.data?.orders.map((o, idx) => (
          <DebugCard key={o.platform_order_id ?? idx} order={o} />
        ))}
      </div>
    </div>
  );
}