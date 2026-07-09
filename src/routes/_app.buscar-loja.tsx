import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { http, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw, Search } from "lucide-react";

export const Route = createFileRoute("/_app/buscar-loja")({
  component: BuscarLojaPage,
});

type Platform = "99food" | "ifood";

interface StoreListItem {
  store_name?: string | null;
  platform?: string | null;
  store_id?: string | null;
}

interface StoreLookupResponse {
  found?: boolean;
  name?: string | null;
  live_name?: string | null;
  status?: string | null;
  [k: string]: unknown;
}

function copyToClipboard(value: string) {
  if (!value) return;
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success("ID copiado"))
    .catch(() => toast.error("Não foi possível copiar"));
}

function BuscarLojaPage() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [storeId, setStoreId] = useState("");
  const [platform, setPlatform] = useState<Platform>("99food");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<StoreLookupResponse | null>(null);
  const [searched, setSearched] = useState(false);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await http.get<StoreListItem[] | { stores?: StoreListItem[] }>(
        "/tools/stores",
        { silent: true },
      );
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.stores)
          ? data.stores
          : [];
      setStores(list);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Falha ao carregar lojas";
      setListError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const id = storeId.trim();
    if (!id) {
      toast.error("Informe o ID da loja");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setResult(null);
    setSearched(false);
    try {
      const data = await http.get<StoreLookupResponse>("/tools/store", {
        silent: true,
        query: { store_id: id, platform, live: 1 },
      });
      setResult(data ?? {});
      setSearched(true);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Falha ao buscar loja";
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  }

  const notFound =
    searched &&
    result !== null &&
    result.found === false &&
    !result.live_name;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Buscar Loja"
        description="Consulte lojas conectadas na sua conta e verifique o status ao vivo por ID."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadStores}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">Buscar por ID</h2>
              <p className="text-sm text-muted-foreground">
                Informe o ID da loja e a plataforma para consultar o status ao vivo.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSearch}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  ID da loja
                </label>
                <Input
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  placeholder="Ex.: 123456"
                  disabled={searching}
                />
              </div>
              <div className="flex flex-col gap-1 sm:w-52">
                <label className="text-xs font-medium text-muted-foreground">
                  Plataforma
                </label>
                <Select
                  value={platform}
                  onValueChange={(v) => setPlatform(v as Platform)}
                  disabled={searching}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="99food">99Food</SelectItem>
                    <SelectItem value="ifood">iFood</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={searching}>
                {searching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Buscar
              </Button>
            </form>

            {searchError && (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {searchError}
              </div>
            )}

            {searched && !searchError && (
              <div className="mt-4">
                {notFound ? (
                  <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Loja não encontrada nesta conta.
                  </div>
                ) : (
                  <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Nome
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {result?.name || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Nome ao vivo
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {result?.live_name || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Status
                      </div>
                      <div className="mt-1">
                        {result?.status ? (
                          <Badge variant="secondary">{result.status}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">Lojas conectadas</h2>
              <p className="text-sm text-muted-foreground">
                Lista das lojas retornadas por <code>/tools/stores</code>.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando lojas…
              </div>
            ) : listError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {listError}
              </div>
            ) : stores.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                Nenhuma loja conectada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Store ID</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stores.map((s, idx) => {
                      const id = s.store_id ?? "";
                      return (
                        <TableRow key={`${s.platform ?? "?"}-${id || idx}`}>
                          <TableCell className="font-medium">
                            {s.store_name || "Loja não identificada"}
                          </TableCell>
                          <TableCell>
                            {s.platform ? (
                              <Badge variant="outline">{s.platform}</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {id || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!id}
                              onClick={() => copyToClipboard(id)}
                              title="Copiar ID"
                              aria-label="Copiar ID"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}