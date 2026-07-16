import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  type UserPlan,
  type UserProfile,
  type DBPlan,
  changePassword,
  disable2FA,
  getProfile,
  getPlansPublic,
  formatPlanPrice,
  setup2FA,
  updateCompany,
  updatePlan,
  updateProfile,
  verify2FA,
  getKdsSettings,
  updateKdsSettings,
  type KdsField,
  ApiError,
} from "@/lib/api";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Configurações — Zero Tempo" }] }),
  component: SettingsPage,
});

const PLAN_LABELS: Record<UserPlan, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    try {
      const p = await getProfile();
      setProfile(p);
      return p;
    } catch {
      setProfile((prev) =>
        prev ?? {
            name: "",
            email: "",
            phone: "",
            company_name: "",
            company_cnpj: "",
            company_address: "",
            plan: "starter",
            totp_enabled: false,
        },
      );
      return null;
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await refetch();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Gerencie seu perfil, plano e segurança da conta."
      />
      <div className="p-4 sm:p-8">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="plan">Planos</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="kds">KDS</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6 space-y-6">
            {loading || !profile ? (
              <Card className="max-w-2xl space-y-3 p-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ) : (
              <>
                <ProfileSection
                  profile={profile}
                  onSaved={refetch}
                />
                <CompanySection
                  profile={profile}
                  onSaved={refetch}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="plan" className="mt-6">
            {loading || !profile ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            ) : (
              <PlansSection
                profile={profile}
                onChanged={(p) => setProfile(p)}
              />
            )}
          </TabsContent>

          <TabsContent value="security" className="mt-6 space-y-6">
            {loading || !profile ? (
              <Card className="max-w-2xl space-y-3 p-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ) : (
              <>
                <PasswordSection />
                <TwoFactorSection
                  profile={profile}
                  onChanged={(p) => setProfile(p)}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="kds" className="mt-6">
            <KdsSettingsSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProfileSection({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => Promise<UserProfile | null>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile.name ?? "");
    setEmail(profile.email ?? "");
    setPhone(profile.phone ?? "");
  }, [profile.name, profile.email, profile.phone]);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, email, phone });
      await onSaved();
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("auth_user");
          const u = raw ? JSON.parse(raw) : {};
          window.localStorage.setItem(
            "auth_user",
            JSON.stringify({ ...u, name, email }),
          );
          window.dispatchEvent(new Event("auth-user-updated"));
        } catch {
          /* ignore */
        }
      }
      toast.success("Perfil atualizado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <h3 className="mb-4 text-lg font-semibold">Dados Pessoais</h3>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button className="w-fit" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Perfil"}
        </Button>
      </div>
    </Card>
  );
}

function CompanySection({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => Promise<UserProfile | null>;
}) {
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCompanyName(profile.company_name ?? "");
    setCnpj(maskCnpj(profile.company_cnpj ?? ""));
    setAddress(profile.company_address ?? "");
  }, [profile.company_name, profile.company_cnpj, profile.company_address]);

  const save = async () => {
    setSaving(true);
    try {
      await updateCompany({
        company_name: companyName,
        company_cnpj: cnpj,
        company_address: address,
      });
      await onSaved();
      toast.success("Dados da empresa atualizados!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <h3 className="mb-4 text-lg font-semibold">Empresa</h3>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Razão Social</Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>CNPJ</Label>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(maskCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div className="grid gap-2">
          <Label>Endereço Fiscal</Label>
          <Textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
          />
        </div>
        <Button className="w-fit" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Empresa"}
        </Button>
      </div>
    </Card>
  );
}

function PlansSection({
  profile,
  onChanged,
}: {
  profile: UserProfile;
  onChanged: (p: UserProfile) => void;
}) {
  const [pending, setPending] = useState<UserPlan | null>(null);
  const [plans, setPlans] = useState<DBPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getPlansPublic()
      .then((d) => setPlans(Array.isArray(d) ? d.filter((p) => p.active !== false) : []))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const confirm = async () => {
    if (!pending) return;
    const target = pending;
    try {
      const p = await updatePlan(target);
      onChanged({ ...profile, ...p, plan: target });
      toast.success(`Plano atualizado para ${PLAN_LABELS[target]}!`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        const payload = (err.payload ?? {}) as {
          requires_payment?: boolean;
          redirect?: string;
        };
        if (payload.requires_payment) {
          setPending(null);
          navigate({
            to: (payload.redirect as "/checkout") ?? "/checkout",
            search: { plan: target } as never,
          });
          return;
        }
      }
    } finally {
      setPending(null);
    }
  };

  if (loadingPlans) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const sorted = [...plans].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );

  const priceLabel = (p: DBPlan) => formatPlanPrice(p);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {sorted.map((p) => {
          const current = profile.plan === (p.slug as UserPlan);
          const highlight = p.popular;
          return (
            <Card
              key={p.id}
              className={`flex flex-col p-6 ${
                highlight ? "border-primary ring-2 ring-primary/20" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                {current && (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">
                    Plano atual
                  </Badge>
                )}
              </div>
              <p className="mt-4 text-2xl font-semibold">{priceLabel(p)}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {(p.features ?? []).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={current ? "outline" : "default"}
                className={`mt-6 w-full ${
                  current ? "border-emerald-600 text-emerald-700" : ""
                }`}
                disabled={current}
                onClick={() => setPending(p.slug as UserPlan)}
              >
                {current ? "Plano atual" : "Selecionar"}
              </Button>
            </Card>
          );
        })}
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar mudança de plano</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja mudar para o plano{" "}
              {pending ?? ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (next.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (next !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSaving(true);
    try {
      await changePassword({ current_password: current, new_password: next });
      toast.success("Senha alterada com sucesso!");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      // toast já exibido pelo http
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <h3 className="mb-4 text-lg font-semibold">Alterar Senha</h3>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Senha Atual</Label>
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Nova Senha</Label>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Confirmar Nova Senha</Label>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button className="w-fit" onClick={submit} disabled={saving}>
          {saving ? "Alterando..." : "Alterar Senha"}
        </Button>
      </div>
    </Card>
  );
}

function TwoFactorSection({
  profile,
  onChanged,
}: {
  profile: UserProfile;
  onChanged: (p: UserProfile) => void;
}) {
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await setup2FA();
      setOtpauth(res.otpauth_url);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    setBusy(true);
    try {
      await verify2FA(code);
      toast.success("2FA ativado com sucesso!");
      onChanged({ ...profile, totp_enabled: true });
      setOtpauth(null);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disable2FA();
      onChanged({ ...profile, totp_enabled: false });
      toast.success("2FA desativado");
    } finally {
      setBusy(false);
      setConfirmDisable(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <h3 className="mb-4 text-lg font-semibold">
        Autenticação em Dois Fatores (2FA)
      </h3>

      {profile.totp_enabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-600">
              <ShieldCheck className="mr-1 h-3 w-3" /> 2FA Ativo
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Sua conta está protegida com autenticação em dois fatores.
          </p>
          <Button
            variant="destructive"
            onClick={() => setConfirmDisable(true)}
            disabled={busy}
          >
            Desativar 2FA
          </Button>
        </div>
      ) : !otpauth ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Adicione uma camada extra de proteção ao seu login.
          </p>
          <Button onClick={startSetup} disabled={busy}>
            {busy ? "Gerando..." : "Ativar 2FA"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code com seu app de autenticação (Google
            Authenticator, Authy, etc).
          </p>
          <div className="flex justify-center rounded-lg border bg-white p-4">
            <QRCodeSVG value={otpauth} size={200} level="M" />
          </div>
          <div className="grid gap-2">
            <Label>Código de 6 dígitos</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={verify} disabled={busy}>
              {busy ? "Verificando..." : "Verificar e Ativar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOtpauth(null);
                setCode("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar 2FA?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua conta ficará menos protegida sem a autenticação em dois
              fatores. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={disable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function KdsSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState<KdsField[]>([]);
  const [fields, setFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getKdsSettings();
      if (!alive) return;
      setAvailable(data.available_fields);
      setFields(data.config.fields);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (key: string, value: boolean) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await updateKdsSettings(fields);
      toast.success("Configuração do KDS salva!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar KDS");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="max-w-3xl space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  const pedido = available.filter((f) => f.group === "pedido");
  const item = available.filter((f) => f.group === "item");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configurar KDS</h2>
        <p className="text-sm text-muted-foreground">
          Escolha quais informações aparecem em cada card da tela da cozinha.
        </p>
      </div>

      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold">Dados do pedido</h3>
        <div className="divide-y">
          {pedido.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum campo disponível.</p>
          ) : (
            pedido.map((f) => (
              <FieldRow
                key={f.key}
                label={f.label}
                checked={!!fields[f.key]}
                onChange={(v) => toggle(f.key, v)}
              />
            ))
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold">Por item</h3>
        <div className="divide-y">
          {item.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum campo disponível.</p>
          ) : (
            item.map((f) => (
              <FieldRow
                key={f.key}
                label={f.label}
                checked={!!fields[f.key]}
                onChange={(v) => toggle(f.key, v)}
              />
            ))
          )}
        </div>
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
}

function FieldRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <Label className="text-sm font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}