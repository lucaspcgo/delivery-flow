import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useUsage } from "@/lib/usage-context";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Copy, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { http, getMeCached, hasAdminAccess, hasStoredAdminAccess } from "@/lib/api";
import { KEETA_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/_app/menu-manager")({
  ssr: false,
  head: () => ({ meta: [{ title: "Gerenciador de Cardápios — Zero Tempo" }] }),
  component: MenuManagerPage,
});

type Platform = "ifood" | "99food" | "keeta";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "99food", label: "99Food" },
  { value: "ifood", label: "iFood" },
  { value: "keeta", label: "Keeta" },
].filter((p) => KEETA_ENABLED || p.value !== "keeta");

interface Restaurant {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string | null;
  available?: boolean;
}

interface CopyResult {
  copied: number;
  failed?: number;
  message?: string;
}

const BRL = (v: number) =>
  `R$ ${Number(v ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function MenuManagerPage() {
  const navigate = useNavigate();
  const storedAdmin = hasStoredAdminAccess();
  const [status, setStatus] = useState<"checking" | "ok" | "denied">(
    storedAdmin ? "ok" : "checking",
  );

  useEffect(() => {
    let alive = true;
    if (hasStoredAdminAccess()) {
      setStatus("ok");
      return () => {
        alive = false;
      };
    }

    getMeCached(true)
      .then((me) => {
        if (!alive) return;
        if (hasAdminAccess(me)) setStatus("ok");
        else if (hasStoredAdminAccess()) setStatus("ok");
        else {
          setStatus("denied");
          toast.error("Acesso negado", {
            description: "Somente administradores podem acessar esta página.",
          });
          navigate({ to: "/dashboard" });
        }
      })
      .catch(() => {
        if (!alive) return;
        if (hasStoredAdminAccess()) {
          setStatus("ok");
          return;
        }
        setStatus("denied");
        navigate({ to: "/login" });
      });
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (!storedAdmin && status !== "ok") {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {status === "checking" ? "Verificando permissões..." : "Redirecionando..."}
      </div>
    );
  }

  return <MenuManager />;
}

function MenuManager() {
  const { usage } = useUsage();
  const menuSyncEnabled = usage?.capabilities?.menu_sync !== false;
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRests, setLoadingRests] = useState(true);

  const [fromRest, setFromRest] = useState<string>("");
  const [fromPlatform, setFromPlatform] = useState<Platform | "">("");
  const [toRest, setToRest] = useState<string>("");
  const [toPlatform, setToPlatform] = useState<Platform | "">("");

  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [copying, setCopying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    http
      .get<Restaurant[]>("/admin/menu/restaurants", { silent: true })
      .then((d) => setRestaurants(Array.isArray(d) ? d : []))
      .catch(() =>
        toast.error("Erro ao carregar restaurantes", {
          description: "Não foi possível listar as lojas disponíveis.",
        }),
      )
      .finally(() => setLoadingRests(false));
  }, []);

  const allSelected = useMemo(
    () => !!items && items.length > 0 && selected.size === items.length,
    [items, selected],
  );

  const toggleAll = () => {
    if (!items) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchMenu = async () => {
    if (!fromRest || !fromPlatform) {
      toast.error("Selecione o restaurante e a plataforma de origem.");
      return;
    }
    setFetching(true);
    setResult(null);
    try {
      const data = await http.post<MenuItem[] | { items: MenuItem[] }>(
        "/admin/menu/fetch",
        { restaurant_id: fromRest, platform: fromPlatform },
        { silent: true },
      );
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setSelected(new Set());
      if (list.length === 0) toast.info("Nenhum item encontrado neste cardápio.");
    } catch (err) {
      toast.error("Erro ao buscar cardápio", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
      setItems(null);
    } finally {
      setFetching(false);
    }
  };

  const copyItems = async () => {
    if (!toRest || !toPlatform) {
      toast.error("Selecione o restaurante e a plataforma de destino.");
      return;
    }
    if (selected.size === 0) return;
    setCopying(true);
    setResult(null);
    try {
      const data = await http.post<CopyResult>(
        "/admin/menu/copy",
        {
          from_restaurant_id: fromRest,
          to_restaurant_id: toRest,
          from_platform: fromPlatform,
          to_platform: toPlatform,
          selected_items: Array.from(selected),
        },
        { silent: true },
      );
      const count = data?.copied ?? selected.size;
      const msg = `${count} ${count === 1 ? "item copiado" : "itens copiados"} com sucesso.`;
      setResult({ ok: true, text: msg });
      toast.success(msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao copiar itens.";
      setResult({ ok: false, text: msg });
      toast.error("Erro ao copiar itens", { description: msg });
    } finally {
      setCopying(false);
    }
  };

  const resetAll = () => {
    setItems(null);
    setSelected(new Set());
    setResult(null);
  };

  const primaryBtn =
    "bg-[#97C459] text-white hover:bg-[#86b04d] focus-visible:ring-[#97C459]";

  return (
    <div>
      <PageHeader
        title="Gerenciador de Cardápios"
        description="Copie itens entre suas lojas"
      />
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        {/* SEÇÃO 1 */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">1. Selecionar loja de origem</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label>Restaurante origem</Label>
              <Select value={fromRest} onValueChange={setFromRest} disabled={loadingRests}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingRests ? "Carregando..." : "Selecionar restaurante origem"} />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plataforma</Label>
              <Select value={fromPlatform} onValueChange={(v) => setFromPlatform(v as Platform)}>
                <SelectTrigger><SelectValue placeholder="Selecionar plataforma" /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={fetchMenu}
              disabled={fetching || !fromRest || !fromPlatform || !menuSyncEnabled}
              className={primaryBtn}
              title={!menuSyncEnabled ? "Sincronização de cardápio disponível em planos superiores" : undefined}
            >
              {fetching ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando...</>
              ) : (
                <><Search className="mr-2 h-4 w-4" /> Buscar cardápio</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* SEÇÃO 2 */}
        {items && (
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">2. Itens do cardápio</CardTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{selected.size} de {items.length} itens selecionados</span>
                <Button variant="outline" size="sm" onClick={toggleAll} disabled={items.length === 0}>
                  {allSelected ? "Desselecionar todos" : "Selecionar todos"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Disponível</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow
                        key={it.id}
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                        onClick={() => toggleOne(it.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(it.id)}
                            onCheckedChange={() => toggleOne(it.id)}
                            aria-label={`Selecionar ${it.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{it.name}</TableCell>
                        <TableCell>{BRL(it.price)}</TableCell>
                        <TableCell>{it.category ?? "—"}</TableCell>
                        <TableCell>{it.available === false ? "Não" : "Sim"}</TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          Nenhum item encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SEÇÃO 3 */}
        {items && items.length > 0 && (
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">3. Copiar para outra loja</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <Label>Restaurante destino</Label>
                <Select value={toRest} onValueChange={setToRest} disabled={loadingRests}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar restaurante destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plataforma destino</Label>
                <Select value={toPlatform} onValueChange={(v) => setToPlatform(v as Platform)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar plataforma destino" /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={copyItems}
                disabled={copying || selected.size === 0 || !toRest || !toPlatform || !menuSyncEnabled}
                title={!menuSyncEnabled ? "Sincronização de cardápio disponível em planos superiores" : undefined}
                className={primaryBtn}
              >
                {copying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Copiando...</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" /> Copiar itens selecionados</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* RESULTADO */}
        {result && (
          <Alert variant={result.ok ? "default" : "destructive"}>
            <AlertTitle>{result.ok ? "Sucesso" : "Falha ao copiar"}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>{result.text}</span>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                  Copiar novamente
                </Button>
                <Button variant="ghost" size="sm" onClick={resetAll}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao início
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}