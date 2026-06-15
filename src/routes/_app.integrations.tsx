import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  type Integration,
  type Platform,
} from "@/lib/api";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({ meta: [{ title: "Integrações — Delivery Auto Pro" }] }),
  component: IntegrationsPage,
});

const PLATFORM_COLORS: Record<Platform, string> = {
  ifood: "#EA1D2C",
  keeta: "#FFCD00",
  "99food": "#FFD300",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "N/A";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "N/A";
  const min = Math.max(0, Math.floor(diffMs / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

function IntegrationsPage() {
  const [list, setList] = useState<Integration[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<Platform | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getIntegrations();
      setList(data);
    } catch {
      setError(true);
      toast.error("Não foi possível carregar as integrações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (i: Integration) => {
    const isConnected = i.status === "connected";
    setPending(i.platform);
    // otimista
    setList((prev) =>
      prev
        ? prev.map((x) =>
            x.platform === i.platform
              ? { ...x, status: isConnected ? "disconnected" : "connected" }
              : x,
          )
        : prev,
    );
    try {
      if (isConnected) await disconnectIntegration(i.platform);
      else await connectIntegration(i.platform);
      toast.success(
        isConnected ? `${i.name} desconectado` : `${i.name} conectado`,
      );
      await load(); // refetch
    } catch {
      // reverter otimista
      setList((prev) =>
        prev
          ? prev.map((x) =>
              x.platform === i.platform ? { ...x, status: i.status } : x,
            )
          : prev,
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <PageHeader title="Integrações" description="Conecte seus marketplaces de delivery para centralizar os pedidos." />
      <div className="grid gap-4 p-4 sm:p-8 md:grid-cols-2 xl:grid-cols-3">
        {loading && !list &&
          [0, 1, 2].map((n) => (
            <Card key={n} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b p-5">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-28" />
                </div>
              </div>
              <div className="space-y-4 p-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          ))}

        {error && !loading && (
          <Card className="col-span-full flex flex-col items-center justify-center gap-3 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as integrações.
            </p>
            <Button onClick={() => void load()}>Tentar novamente</Button>
          </Card>
        )}

        {list?.map((i) => {
          const connected = i.status === "connected";
          const color = PLATFORM_COLORS[i.platform] ?? "#64748b";
          return (
          <Card key={i.id} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white" style={{ background: color }}>
                {i.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{i.name}</h3>
                <Badge variant="outline" className={connected ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}>
                  {connected ? (<><CheckCircle2 className="mr-1 h-3 w-3" />Conectado</>) : "Não conectado"}
                </Badge>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">{i.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                <div><dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Pedidos</dt><dd className="font-semibold">{i.orders_count}</dd></div>
                <div><dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Sync</dt><dd className="font-semibold truncate">{formatRelative(i.last_sync_at)}</dd></div>
                <div><dt className="text-[10px] text-muted-foreground uppercase tracking-wider">API</dt><dd className="font-semibold capitalize">{i.api_status}</dd></div>
              </dl>
              <Button onClick={() => toggle(i)} disabled={pending === i.platform} variant={connected ? "outline" : "default"} className="mt-5 w-full">
                {connected ? "Desconectar" : "Conectar"}
              </Button>
            </div>
          </Card>
        );
        })}
      </div>
    </div>
  );
}