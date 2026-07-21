import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  ifoodAuth,
  ApiError,
  getRestaurants,
  updateRestaurant,
  connectPlatform,
  disconnectPlatform,
  type IfoodAuthStart,
  type Integration,
  type Platform,
} from "@/lib/api";
import { nineNineFoodApi } from "@/lib/api";
import { KEETA_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({ meta: [{ title: "Integrações — Zero Tempo" }] }),
  component: IntegrationsPage,
});

const PLATFORM_COLORS: Record<Platform, string> = {
  ifood: "#EA1D2C",
  keeta: "#FFCD00",
  "99food": "#FFD300",
};

const FALLBACK_INTEGRATIONS: Integration[] = [
  {
    id: "fallback-ifood",
    platform: "ifood",
    name: "iFood",
    description: "Maior marketplace de delivery do Brasil. Receba pedidos automaticamente.",
    status: "disconnected",
    orders_count: 0,
    last_sync_at: null,
    api_status: "offline",
  },
  {
    id: "fallback-99food",
    platform: "99food",
    name: "99Food",
    description: "Serviço de delivery da 99, integrado ao app de mobilidade.",
    status: "disconnected",
    orders_count: 0,
    last_sync_at: null,
    api_status: "offline",
  },
  {
    id: "fallback-keeta",
    platform: "keeta",
    name: "Keeta",
    description: "Plataforma global de delivery em rápida expansão no mercado.",
    status: "disconnected",
    orders_count: 0,
    last_sync_at: null,
    api_status: "offline",
  },
];

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
  const [storeCounts, setStoreCounts] = useState<Record<Platform, number>>({
    ifood: 0,
    keeta: 0,
    "99food": 0,
  });
  type StoreEntry = { id: string; name: string; status: string; platform: Platform; merchant_id: string };
  const [storesByPlatform, setStoresByPlatform] = useState<Record<Platform, StoreEntry[]>>({
    ifood: [],
    keeta: [],
    "99food": [],
  });

  // Manage store modal state
  const [manageOpen, setManageOpen] = useState(false);
  const [manageStore, setManageStore] = useState<StoreEntry | null>(null);
  const [manageName, setManageName] = useState("");
  const [manageMerchant, setManageMerchant] = useState("");
  const [manageSaving, setManageSaving] = useState(false);
  const [manageDisconnecting, setManageDisconnecting] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  // iFood authorization-code flow state
  const [ifoodAuthorized, setIfoodAuthorized] = useState<boolean | null>(null);
  const [ifoodAccounts, setIfoodAccounts] = useState<number>(0);
  const [ifoodStoresCount, setIfoodStoresCount] = useState<number>(0);
  const [ifoodOpen, setIfoodOpen] = useState(false);
  const [ifoodStarting, setIfoodStarting] = useState(false);
  const [ifoodCompleting, setIfoodCompleting] = useState(false);
  const [ifoodCode, setIfoodCode] = useState<IfoodAuthStart | null>(null);
  const [ifoodError, setIfoodError] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 99Food connect-shop state
  const [nnfOpen, setNnfOpen] = useState(false);
  const [nnfShopId, setNnfShopId] = useState("");
  const [nnfName, setNnfName] = useState("");
  const [nnfSubmitting, setNnfSubmitting] = useState(false);
  const [nnfError, setNnfError] = useState<string | null>(null);
  const [nnfStep, setNnfStep] = useState<1 | 2 | 3 | 4>(1);
  const [nnfAuthUrl, setNnfAuthUrl] = useState<string | null>(null);
  const [nnfAuthUrlLoading, setNnfAuthUrlLoading] = useState(false);
  const [nnfAuthorized, setNnfAuthorized] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getIntegrations();
      setList(data && data.length > 0 ? data : FALLBACK_INTEGRATIONS);
      try {
        const restaurants = await getRestaurants();
        const counts: Record<Platform, number> = { ifood: 0, keeta: 0, "99food": 0 };
        const byPlatform: Record<Platform, StoreEntry[]> = {
          ifood: [],
          keeta: [],
          "99food": [],
        };
        for (const r of restaurants) {
          for (const p of r.platforms ?? []) {
            if (p.status === "authorized" && (p.platform === "ifood" || p.platform === "99food" || p.platform === "keeta")) {
              counts[p.platform as Platform] += 1;
              byPlatform[p.platform as Platform].push({
                id: r.id,
                name: r.name,
                status: p.status,
                platform: p.platform as Platform,
                merchant_id: p.platform_merchant_id ?? "",
              });
            }
          }
        }
        setStoreCounts(counts);
        // ifood usa endpoint dedicado (/integrations/ifood/stores); preserve o que refreshIfoodStatus carregou.
        setStoresByPlatform((prev) => ({
          ifood: prev.ifood,
          "99food": byPlatform["99food"],
          keeta: byPlatform.keeta,
        }));
      } catch {
        // ignore
      }
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

  // Verifica status inicial do iFood
  const refreshIfoodStatus = useCallback(async () => {
    try {
      const s = await ifoodAuth.status();
      setIfoodAuthorized(!!s.authorized);
      setIfoodAccounts(s.accounts ?? 0);
      setIfoodStoresCount(s.stores_count ?? 0);
    } catch {
      setIfoodAuthorized(false);
    }
    try {
      const list = await ifoodAuth.stores();
      const entries: StoreEntry[] = (list ?? []).map((s) => ({
        id: s.restaurant_id,
        name: s.name,
        status: s.status,
        platform: "ifood",
        merchant_id: s.merchant_id ?? "",
      }));
      setStoresByPlatform((prev) => ({ ...prev, ifood: entries }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshIfoodStatus();
  }, [refreshIfoodStatus]);

  // Countdown do userCode
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (!ifoodCode) return;
    setCountdown(ifoodCode.expiresIn);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [ifoodCode]);

  const extractErrMsg = (err: unknown): string => {
    if (err instanceof ApiError) {
      const p = err.payload as { error?: string; details?: string; message?: string } | null;
      return p?.details || p?.error || p?.message || err.message;
    }
    return err instanceof Error ? err.message : "Erro desconhecido";
  };

  const openManage = (s: StoreEntry) => {
    setManageStore(s);
    setManageName(s.name);
    setManageMerchant(s.merchant_id ?? "");
    setManageError(null);
    setManageOpen(true);
  };

  const saveManage = async () => {
    if (!manageStore) return;
    if (!manageName.trim()) {
      setManageError("O nome não pode ficar vazio.");
      return;
    }
    setManageSaving(true);
    setManageError(null);
    try {
      const tasks: Promise<unknown>[] = [];
      if (manageName.trim() !== manageStore.name) {
        tasks.push(updateRestaurant(manageStore.id, { name: manageName.trim() }));
      }
      if ((manageMerchant.trim() || "") !== (manageStore.merchant_id ?? "")) {
        tasks.push(
          connectPlatform(manageStore.id, {
            platform: manageStore.platform,
            platform_merchant_id: manageMerchant.trim(),
          }),
        );
      }
      if (tasks.length === 0) {
        setManageOpen(false);
        return;
      }
      await Promise.all(tasks);
      toast.success("Loja atualizada");
      setManageOpen(false);
      await load();
    } catch (err) {
      setManageError(extractErrMsg(err));
    } finally {
      setManageSaving(false);
    }
  };

  const disconnectManage = async () => {
    if (!manageStore) return;
    if (!confirm(`Desconectar a loja "${manageStore.name}" do ${manageStore.platform}?`)) return;
    setManageDisconnecting(true);
    setManageError(null);
    try {
      await disconnectPlatform(manageStore.id, manageStore.platform);
      toast.success("Loja desconectada");
      setManageOpen(false);
      await load();
    } catch (err) {
      setManageError(extractErrMsg(err));
    } finally {
      setManageDisconnecting(false);
    }
  };

  const startIfoodAuth = useCallback(async () => {
    setIfoodStarting(true);
    setIfoodError(null);
    setIfoodCode(null);
    setAuthCode("");
    try {
      const data = await ifoodAuth.start();
      setIfoodCode(data);
    } catch (err) {
      const msg = extractErrMsg(err);
      setIfoodError(msg);
      toast.error("Falha ao iniciar autorização", { description: msg });
    } finally {
      setIfoodStarting(false);
    }
  }, []);

  const openIfoodModal = () => {
    setIfoodOpen(true);
    void startIfoodAuth();
  };

  const completeIfoodAuth = async () => {
    if (!authCode.trim()) {
      setIfoodError("Cole o código de autorização.");
      return;
    }
    setIfoodCompleting(true);
    setIfoodError(null);
    try {
      const data = await ifoodAuth.complete(authCode.trim());
      if (data.success) {
        const names = (data.connected ?? []).map((c) => c.name);
        setIfoodAuthorized(true);
        setIfoodOpen(false);
        setIfoodCode(null);
        setAuthCode("");
        if (data.pending) {
          toast.success("Autorização recebida!", {
            description:
              data.message ||
              "As lojas podem levar até 10 minutos para aparecer.",
          });
        } else {
          toast.success("iFood conectado com sucesso!", {
            description: names.length
              ? `Loja(s) conectada(s): ${names.join(", ")}`
              : undefined,
          });
        }
        await Promise.all([load(), refreshIfoodStatus()]);
      } else {
        setIfoodError("Autorização não concluída. Confirme o código no portal do iFood.");
      }
    } catch (err) {
      const msg = extractErrMsg(err);
      setIfoodError(msg);
    } finally {
      setIfoodCompleting(false);
    }
  };

  const mmss = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  const copyUserCode = async () => {
    if (!ifoodCode) return;
    try {
      await navigator.clipboard.writeText(ifoodCode.userCode);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const openNnfModal = () => {
    setNnfShopId("");
    setNnfName("");
    setNnfError(null);
    setNnfStep(1);
    setNnfAuthUrl(null);
    setNnfAuthorized(false);
    setNnfOpen(true);
  };

  const goToNnfAuthStep = async () => {
    if (!nnfShopId.trim()) {
      setNnfError("Informe o Shop ID.");
      return;
    }
    setNnfError(null);
    setNnfStep(2);
    setNnfAuthUrlLoading(true);
    try {
      const data = await nineNineFoodApi.authorizeUrl();
      setNnfAuthUrl(data.url);
    } catch (err) {
      setNnfError(extractErrMsg(err));
    } finally {
      setNnfAuthUrlLoading(false);
    }
  };

  const submitNnf = async () => {
    if (!nnfShopId.trim()) {
      setNnfError("Informe o Shop ID.");
      return;
    }
    setNnfSubmitting(true);
    setNnfError(null);
    try {
      const data = await nineNineFoodApi.connectShop(
        nnfShopId.trim(),
        nnfName.trim() || undefined,
      );
      if (data.success) {
        const label =
          data.connected?.map((c) => c.name).join(", ") ||
          data.name ||
          nnfName.trim() ||
          nnfShopId.trim();
        toast.success(`Loja 99Food conectada: ${label}`);
        setNnfStep(3);
        await load();
      } else {
        setNnfError("Não foi possível conectar a loja.");
      }
    } catch (err) {
      const msg = extractErrMsg(err);
      if (/10101|does not exist/i.test(msg)) {
        setNnfError(
          "A loja ainda não autorizou o app. Volte ao passo 2 e autorize no portal do 99Food.",
        );
      } else {
        setNnfError(msg);
      }
    } finally {
      setNnfSubmitting(false);
    }
  };

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

        {list?.filter((i) => KEETA_ENABLED || i.platform !== "keeta").map((i) => {
          const connected = i.status === "connected";
          const color = PLATFORM_COLORS[i.platform] ?? "#64748b";
          const isIfood = i.platform === "ifood";
          const ifoodConnected = isIfood && (ifoodAuthorized === true || connected);
          return (
          <Card key={i.id} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white" style={{ background: color }}>
                {i.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{i.name}</h3>
                <Badge variant="outline" className={(isIfood ? ifoodConnected : connected) ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}>
                  <CheckCircle2 className="mr-1 h-3 w-3" />Conectado
                </Badge>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">{i.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                <div>
                  <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Lojas</dt>
                  <dd className="font-semibold">
                    {isIfood ? ifoodStoresCount : (storeCounts[i.platform] ?? 0)}
                  </dd>
                  {isIfood && ifoodAccounts > 1 && (
                    <dd className="text-[11px] text-muted-foreground">em {ifoodAccounts} contas</dd>
                  )}
                </div>
                <div><dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Sync</dt><dd className="font-semibold truncate">{formatRelative(i.last_sync_at)}</dd></div>
                <div><dt className="text-[10px] text-muted-foreground uppercase tracking-wider">API</dt><dd className="font-semibold capitalize text-emerald-600">Online</dd></div>
              </dl>
              {(i.platform === "ifood" || i.platform === "99food") && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Lojas conectadas</p>
                  {storesByPlatform[i.platform].length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma loja conectada.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-40 overflow-auto">
                      {storesByPlatform[i.platform].map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{s.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              <CheckCircle2 className="mr-1 h-3 w-3" />Autorizado
                            </Badge>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openManage(s)}>
                              Gerenciar
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {isIfood ? (
                <div className="mt-5 space-y-2">
                  {ifoodConnected && (
                    <p className="text-xs text-muted-foreground">
                      {ifoodStoresCount} {ifoodStoresCount === 1 ? "loja conectada" : "lojas conectadas"}
                      {ifoodAccounts > 1 ? ` em ${ifoodAccounts} contas` : ""}. Você pode conectar mais de uma conta iFood (uma por login diferente).
                    </p>
                  )}
                  <Button className="w-full" onClick={openIfoodModal} disabled={ifoodAuthorized === null}>
                    {ifoodConnected ? "Conectar outra conta iFood" : "Conectar loja iFood"}
                  </Button>
                  {ifoodConnected && (
                    <Button variant="outline" className="w-full" onClick={() => toggle(i)} disabled={pending === i.platform}>
                      Desconectar
                    </Button>
                  )}
                </div>
              ) : i.platform === "99food" ? (
                <div className="mt-5">
                  {connected ? (
                    <Button variant="outline" className="w-full" onClick={() => toggle(i)} disabled={pending === i.platform}>
                      Desconectar
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={openNnfModal}>
                      Conectar loja 99Food
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={() => toggle(i)} disabled={pending === i.platform} variant={connected ? "outline" : "default"} className="mt-5 w-full">
                  {connected ? "Desconectar" : "Conectar"}
                </Button>
              )}
            </div>
          </Card>
        );
        })}
      </div>

      <Dialog open={ifoodOpen} onOpenChange={(open) => {
        setIfoodOpen(open);
        if (!open) {
          setIfoodCode(null);
          setAuthCode("");
          setIfoodError(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar loja iFood</DialogTitle>
            <DialogDescription>
              Autorize o Zero Tempo no portal do iFood em 2 passos.
            </DialogDescription>
          </DialogHeader>

          <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/od5cVEBHBus"
              title="Tutorial: Conectar loja iFood"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {ifoodStarting || !ifoodCode ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Passo 1 */}
              <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Passo 1 — Ativação no portal
                </p>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Código de ativação
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="flex-1 font-mono text-2xl font-bold tracking-widest">
                      {ifoodCode.userCode}
                    </p>
                    <Button size="icon" variant="outline" onClick={() => void copyUserCode()} title="Copiar código">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button asChild className="w-full">
                  <a href={ifoodCode.verificationUrlComplete} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir portal do iFood
                  </a>
                </Button>
                <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                  <li>Faça login no iFood.</li>
                  <li>Cole o código de ativação acima.</li>
                  <li>O portal vai te mostrar um <strong>código de autorização</strong> — copie ele.</li>
                </ol>
                <p className="text-center text-xs font-medium">
                  {countdown > 0 ? (
                    <>Expira em {mmss(countdown)}</>
                  ) : (
                    <span className="text-destructive">Código expirado</span>
                  )}
                </p>
                {countdown === 0 && (
                  <Button variant="outline" className="w-full" onClick={() => void startIfoodAuth()} disabled={ifoodStarting}>
                    Gerar novo código
                  </Button>
                )}
              </div>

              {/* Passo 2 */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Passo 2 — Colar o código de autorização
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="ifood-auth-code">Código de autorização</Label>
                  <Input
                    id="ifood-auth-code"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    placeholder="Cole aqui o código do portal"
                    autoComplete="off"
                    disabled={ifoodCompleting}
                  />
                </div>
                {ifoodError && (
                  <p className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    {ifoodError}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIfoodOpen(false)} disabled={ifoodCompleting}>
              Cancelar
            </Button>
            <Button onClick={() => void completeIfoodAuth()} disabled={ifoodCompleting || !ifoodCode || !authCode.trim()}>
              {ifoodCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar / Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={nnfOpen} onOpenChange={setNnfOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar loja 99Food</DialogTitle>
            <DialogDescription>
              {nnfStep === 1 && "Passo 1 de 3 — Informe os dados da loja."}
              {nnfStep === 2 && "Passo 2 de 3 — Autorize o Zero Tempo no portal 99Food."}
              {nnfStep === 3 && "Pronto! Loja conectada."}
            </DialogDescription>
          </DialogHeader>

          {nnfStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nnf-shop-id">Shop ID</Label>
                <Input
                  id="nnf-shop-id"
                  value={nnfShopId}
                  onChange={(e) =>
                    setNnfShopId(e.target.value.replace(/\D+/g, ""))
                  }
                  onPaste={(e) => {
                    e.preventDefault();
                    const txt = e.clipboardData.getData("text").replace(/\D+/g, "");
                    setNnfShopId(txt);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Ex.: 123456789"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Encontre o Shop ID no portal do 99Food, em detalhes da loja.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nnf-name">Nome da loja (opcional)</Label>
                <Input
                  id="nnf-name"
                  value={nnfName}
                  onChange={(e) => setNnfName(e.target.value)}
                  placeholder="Ex.: Minha Lanchonete - Centro"
                  autoComplete="off"
                />
              </div>
              {nnfError && (
                <p className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  {nnfError}
                </p>
              )}
            </div>
          )}

          {nnfStep === 2 && (
            <div className="space-y-4">
              {nnfAuthUrlLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Faça login no 99Food e clique em Autorizar.
                  </p>
                  <Button asChild className="w-full" disabled={!nnfAuthUrl}>
                    <a
                      href={nnfAuthUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir portal 99Food para autorizar
                    </a>
                  </Button>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={nnfAuthorized}
                      onCheckedChange={(v) => setNnfAuthorized(v === true)}
                    />
                    <span>Já autorizei no portal 99Food</span>
                  </label>
                  {nnfError && (
                    <p className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                      {nnfError}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {nnfStep === 3 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <p className="text-base font-semibold">Loja conectada!</p>
              <p className="text-sm text-muted-foreground">
                A loja do 99Food foi vinculada ao Zero Tempo.
              </p>
            </div>
          )}

          <DialogFooter>
            {nnfStep === 1 && (
              <>
                <Button variant="outline" onClick={() => setNnfOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void goToNnfAuthStep()}
                  disabled={!/^\d+$/.test(nnfShopId)}
                >
                  Continuar
                </Button>
              </>
            )}
            {nnfStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setNnfStep(1)} disabled={nnfSubmitting}>
                  Voltar
                </Button>
                <Button
                  onClick={() => void submitNnf()}
                  disabled={nnfSubmitting || !nnfAuthorized}
                >
                  {nnfSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Conectar
                </Button>
              </>
            )}
            {nnfStep === 3 && (
              <Button onClick={() => setNnfOpen(false)}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar loja</DialogTitle>
            <DialogDescription>
              Edite o nome da loja e o merchant_id de teste.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="manage-name">Nome da loja</Label>
              <Input
                id="manage-name"
                value={manageName}
                onChange={(e) => setManageName(e.target.value)}
                disabled={manageSaving}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="manage-merchant">Merchant ID (teste)</Label>
              <Input
                id="manage-merchant"
                value={manageMerchant}
                onChange={(e) => setManageMerchant(e.target.value)}
                placeholder="Ex.: 123e4567-e89b-..."
                disabled={manageSaving}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Plataforma:{" "}
                <span className="font-medium capitalize">
                  {manageStore?.platform}
                </span>
              </p>
            </div>
            {manageError && (
              <p className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                {manageError}
              </p>
            )}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => void disconnectManage()}
              disabled={manageSaving || manageDisconnecting}
            >
              {manageDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desconectar loja
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setManageOpen(false)} disabled={manageSaving || manageDisconnecting}>
                Cancelar
              </Button>
              <Button onClick={() => void saveManage()} disabled={manageSaving || manageDisconnecting}>
                {manageSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}