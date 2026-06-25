import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Plus, Trash2, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  connectPlatform,
  disconnectPlatform,
  authorizeStore,
  type ApiRestaurant,
  type RestaurantInput,
  type RestaurantPlatform,
  type RestaurantPlatformCode,
  type AuthorizeStoreResponse,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, CheckCircle2, Store } from "lucide-react";

export const Route = createFileRoute("/_app/restaurants")({
  head: () => ({ meta: [{ title: "Restaurantes — Delivery Auto Pro" }] }),
  component: RestaurantsPage,
});

const PLATFORM_BADGE: Record<
  RestaurantPlatformCode,
  { label: string; className: string }
> = {
  ifood: { label: "iFood", className: "bg-red-100 text-red-700 border-red-200" },
  "99food": {
    label: "99Food",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  keeta: {
    label: "Keeta",
    className: "bg-green-100 text-green-700 border-green-200",
  },
};

function isAuthorized(p?: RestaurantPlatform) {
  return !!p && p.status === "authorized";
}

function findPlatform(r: ApiRestaurant, code: RestaurantPlatformCode) {
  return r.platforms?.find((p) => p.platform === code);
}

const EMPTY_FORM: RestaurantInput = {
  name: "",
  responsible_name: "",
  phone: "",
  email: "",
  address: "",
};

function RestaurantsPage() {
  const [list, setList] = useState<ApiRestaurant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await getRestaurants());
    } catch {
      setError("Não foi possível carregar os restaurantes");
      toast.error("Erro ao carregar restaurantes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const managed = list?.find((r) => r.id === manageId) ?? null;
  const toDelete = list?.find((r) => r.id === deleteId) ?? null;

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteRestaurant(toDelete.id);
      toast.success("Restaurante removido");
      setDeleteId(null);
      load();
    } catch {
      toast.error("Não foi possível excluir");
    }
  };

  return (
    <div className="min-h-screen bg-muted/10">
      <PageHeader
        title="Restaurantes"
        description="Gerencie suas lojas e as plataformas conectadas"
        actions={
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Restaurante
          </Button>
        }
      />

      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
        {loading && (
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-6 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-9 w-32" />
              </Card>
            ))}
          </div>
        )}

        {!loading && error && (
          <Card className="p-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={load} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
          </Card>
        )}

        {!loading && !error && list && list.length === 0 && (
          <Card className="p-12 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Nenhum restaurante cadastrado
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="mr-2 h-4 w-4" /> Cadastrar primeiro
            </Button>
          </Card>
        )}

        {!loading && !error && list && list.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {list.map((r) => {
              const connected = (
                ["ifood", "99food", "keeta"] as RestaurantPlatformCode[]
              ).filter((code) => isAuthorized(findPlatform(r, code)));
              return (
                <Card
                  key={r.id}
                  className="p-6 rounded-xl shadow-sm bg-card space-y-3"
                >
                  <div>
                    <h3 className="text-base font-bold">{r.name}</h3>
                    {r.responsible_name && (
                      <p className="text-sm text-muted-foreground">
                        {r.responsible_name}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    {r.phone && <p>{r.phone}</p>}
                    {r.email && <p>{r.email}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {connected.length === 0 ? (
                      <Badge
                        variant="outline"
                        className="bg-slate-100 text-slate-600 border-slate-200"
                      >
                        Não conectado
                      </Badge>
                    ) : (
                      connected.map((code) => (
                        <Badge
                          key={code}
                          variant="outline"
                          className={PLATFORM_BADGE[code].className}
                        >
                          {PLATFORM_BADGE[code].label}
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setManageId(r.id)}
                    >
                      <Settings2 className="h-4 w-4 mr-1.5" /> Gerenciar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteId(r.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateRestaurantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />

      <ManageRestaurantDialog
        restaurant={managed}
        onClose={() => setManageId(null)}
        onChanged={load}
      />

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir restaurante?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. {toDelete?.name} será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CreateRestaurantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [platform, setPlatform] = useState<RestaurantPlatformCode>("ifood");
  const [platformId, setPlatformId] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [found, setFound] = useState<AuthorizeStoreResponse | null>(null);

  useEffect(() => {
    if (open) {
      setPlatform("ifood");
      setPlatformId("");
      setFound(null);
      setSearching(false);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    setFound(null);
    setPlatformId("");
  }, [platform]);

  const fieldConfig: Record<
    RestaurantPlatformCode,
    { label: string; placeholder: string; hint: string }
  > = {
    ifood: {
      label: "Merchant ID *",
      placeholder: "Ex: b71abedf-3ccd-4440-90b9-a2f3385e6e24",
      hint: "Encontre no portal iFood Developer → Meus aplicativos → Permissões → Ver detalhes da loja",
    },
    "99food": {
      label: "App Shop ID *",
      placeholder: "Ex: loja_teste_001",
      hint: "Encontre no portal 99Food Developer → Gerenciamento da loja → coluna AppShopID",
    },
    keeta: {
      label: "Store ID *",
      placeholder: "Ex: store_123",
      hint: "Informe o Store ID fornecido pela Keeta.",
    },
  };

  const cfg = fieldConfig[platform];

  const handleSearch = async () => {
    if (!platformId.trim()) {
      toast.error("Informe o ID da loja");
      return;
    }
    setSearching(true);
    setFound(null);
    try {
      const data = await authorizeStore(platform, platformId.trim());
      setFound(data);
    } catch {
      toast.error("Loja não encontrada. Verifique o ID informado.");
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = async () => {
    if (!found) return;
    setSaving(true);
    try {
      const created = await createRestaurant({
        name: found.name ?? "Loja sem nome",
        responsible_name: found.responsible_name ?? "",
        phone: found.phone ?? "",
        email: found.email ?? "",
        address: found.address ?? "",
      });
      const connectData: Record<string, string> = { platform };
      if (platform === "ifood") {
        connectData.platform_merchant_id = platformId.trim();
      } else if (platform === "99food") {
        connectData.app_shop_id = platformId.trim();
        if (found.platform_store_id)
          connectData.platform_store_id = String(found.platform_store_id);
      } else {
        connectData.platform_store_id = platformId.trim();
      }
      try {
        await connectPlatform(created.id, connectData as never);
      } catch {
        // o restaurante já foi criado; seguimos
      }
      toast.success("Restaurante cadastrado e conectado!");
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("Não foi possível cadastrar o restaurante");
    } finally {
      setSaving(false);
    }
  };

  const badge = PLATFORM_BADGE[platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-lg border flex items-center justify-center",
                badge.className,
              )}
            >
              <Store className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Novo Restaurante</DialogTitle>
              <DialogDescription>
                Busque a loja na plataforma para cadastrar automaticamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium">Plataforma *</Label>
            <Select
              value={platform}
              onValueChange={(v) =>
                setPlatform(v as RestaurantPlatformCode)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ifood">iFood</SelectItem>
                <SelectItem value="99food">99Food</SelectItem>
                <SelectItem value="keeta">Keeta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-medium">{cfg.label}</Label>
            <Input
              value={platformId}
              onChange={(e) => {
                setPlatformId(e.target.value);
                setFound(null);
              }}
              placeholder={cfg.placeholder}
            />
            <p className="text-xs text-muted-foreground">{cfg.hint}</p>
          </div>

          {!found && (
            <Button
              onClick={handleSearch}
              disabled={searching || !platformId.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar Loja
            </Button>
          )}

          {found && (
            <Card className="p-4 space-y-2 border-green-200 bg-green-50">
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                <CheckCircle2 className="h-4 w-4" /> Loja encontrada!
              </div>
              <div className="text-sm">
                <p className="font-semibold">
                  {found.name ?? "Loja sem nome"}
                </p>
                {found.address && (
                  <p className="text-muted-foreground">{found.address}</p>
                )}
                {found.phone && (
                  <p className="text-muted-foreground">{found.phone}</p>
                )}
              </div>
              <Button
                onClick={handleConfirm}
                disabled={saving}
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirmar e Cadastrar
              </Button>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageRestaurantDialog({
  restaurant,
  onClose,
  onChanged,
}: {
  restaurant: ApiRestaurant | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [form, setForm] = useState<RestaurantInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name,
        responsible_name: restaurant.responsible_name ?? "",
        phone: restaurant.phone ?? "",
        email: restaurant.email ?? "",
        address: restaurant.address ?? "",
      });
    }
  }, [restaurant]);

  if (!restaurant) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateRestaurant(restaurant.id, form);
      toast.success("Dados atualizados");
      onChanged();
    } catch {
      toast.error("Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!restaurant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Restaurante</DialogTitle>
          <DialogDescription>
            Edite os dados e configure as plataformas conectadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <Card className="p-4 space-y-3">
            <h4 className="text-sm font-semibold">Dados do restaurante</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Nome"
                value={form.name ?? ""}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                label="Responsável"
                value={form.responsible_name ?? ""}
                onChange={(v) => setForm({ ...form, responsible_name: v })}
              />
              <Field
                label="Telefone"
                value={form.phone ?? ""}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <Field
                label="Email"
                value={form.email ?? ""}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Endereço"
                  value={form.address ?? ""}
                  onChange={(v) => setForm({ ...form, address: v })}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                Salvar
              </Button>
            </div>
          </Card>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Plataformas Conectadas</h4>
            <PlatformCard
              restaurant={restaurant}
              code="ifood"
              title="iFood"
              colorClass="bg-red-600 hover:bg-red-700 text-white"
              hint="Encontre o Merchant ID no portal iFood Developer → Meus aplicativos → Permissões → Ver detalhes da loja"
              fields={[{ key: "platform_merchant_id", label: "Merchant ID" }]}
              onChanged={onChanged}
            />
            <PlatformCard
              restaurant={restaurant}
              code="99food"
              title="99Food"
              colorClass="bg-yellow-500 hover:bg-yellow-600 text-white"
              hint="Encontre o App Shop ID e Shop ID no portal 99Food Developer → Gerenciamento da loja"
              fields={[
                { key: "app_shop_id", label: "App Shop ID" },
                { key: "platform_store_id", label: "Shop ID" },
              ]}
              onChanged={onChanged}
            />
            <PlatformCard
              restaurant={restaurant}
              code="keeta"
              title="Keeta"
              colorClass="bg-green-600 hover:bg-green-700 text-white"
              hint="Informe o Store ID da Keeta para conectar a loja."
              fields={[{ key: "platform_store_id", label: "Store ID" }]}
              onChanged={onChanged}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PlatformFieldKey =
  | "platform_store_id"
  | "platform_merchant_id"
  | "app_shop_id";

function PlatformCard({
  restaurant,
  code,
  title,
  hint,
  colorClass,
  fields,
  onChanged,
}: {
  restaurant: ApiRestaurant;
  code: RestaurantPlatformCode;
  title: string;
  hint: string;
  colorClass: string;
  fields: { key: PlatformFieldKey; label: string }[];
  onChanged: () => void;
}) {
  const existing = findPlatform(restaurant, code);
  const connected = isAuthorized(existing);
  const [values, setValues] = useState<Record<PlatformFieldKey, string>>({
    platform_store_id: existing?.platform_store_id ?? "",
    platform_merchant_id: existing?.platform_merchant_id ?? "",
    app_shop_id: existing?.app_shop_id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [confirmDisc, setConfirmDisc] = useState(false);

  useEffect(() => {
    setValues({
      platform_store_id: existing?.platform_store_id ?? "",
      platform_merchant_id: existing?.platform_merchant_id ?? "",
      app_shop_id: existing?.app_shop_id ?? "",
    });
  }, [
    existing?.platform_store_id,
    existing?.platform_merchant_id,
    existing?.app_shop_id,
  ]);

  const handleConnect = async () => {
    for (const f of fields) {
      if (!values[f.key]?.trim()) {
        toast.error(`Informe ${f.label}`);
        return;
      }
    }
    setBusy(true);
    try {
      await connectPlatform(restaurant.id, {
        platform: code,
        platform_store_id: values.platform_store_id || undefined,
        platform_merchant_id: values.platform_merchant_id || undefined,
        app_shop_id: values.app_shop_id || undefined,
      });
      toast.success(`${title} conectado com sucesso!`);
      onChanged();
    } catch {
      toast.error(`Não foi possível conectar ${title}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectPlatform(restaurant.id, code);
      toast.success(`${title} desconectado`);
      setConfirmDisc(false);
      onChanged();
    } catch {
      toast.error(`Não foi possível desconectar ${title}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold">{title}</h5>
        {connected && (
          <Badge className="bg-green-100 text-green-700 border border-green-200">
            Autorizado
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={values[f.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
          />
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        {connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmDisc(true)}
            disabled={busy}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            Desconectar
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={busy}
            className={cn(colorClass)}
          >
            Conectar {title}
          </Button>
        )}
      </div>

      <AlertDialog open={confirmDisc} onOpenChange={setConfirmDisc}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Desconectar {title} deste restaurante?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-red-600 hover:bg-red-700"
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}