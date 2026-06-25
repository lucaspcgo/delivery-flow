import { createFileRoute } from "@tanstack/react-router";
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
import {
  type UserPlan,
  type UserProfile,
  changePassword,
  disable2FA,
  getProfile,
  setup2FA,
  updateCompany,
  updatePlan,
  updateProfile,
  verify2FA,
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

  useEffect(() => {
    let alive = true;
    getProfile()
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {
        if (alive)
          setProfile({
            name: "",
            email: "",
            phone: "",
            company_name: "",
            company_cnpj: "",
            company_address: "",
            plan: "starter",
            totp_enabled: false,
          });
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Gerencie seu perfil, plano e segurança da conta."
      />
      <div className="p-4 sm:p-8">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="plan">Planos</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
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
                  onSaved={(p) => setProfile(p)}
                />
                <CompanySection
                  profile={profile}
                  onSaved={(p) => setProfile(p)}
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
  onSaved: (p: UserProfile) => void;
}) {
  const [name, setName] = useState(profile.name ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const p = await updateProfile({ name, email, phone });
      onSaved({ ...profile, ...p });
      toast.success("Perfil atualizado!");
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
  onSaved: (p: UserProfile) => void;
}) {
  const [companyName, setCompanyName] = useState(profile.company_name ?? "");
  const [cnpj, setCnpj] = useState(maskCnpj(profile.company_cnpj ?? ""));
  const [address, setAddress] = useState(profile.company_address ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const p = await updateCompany({
        company_name: companyName,
        company_cnpj: cnpj,
        company_address: address,
      });
      onSaved({ ...profile, ...p });
      toast.success("Dados da empresa atualizados!");
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

  const confirm = async () => {
    if (!pending) return;
    try {
      const p = await updatePlan(pending);
      onChanged({ ...profile, ...p, plan: pending });
      toast.success(`Plano atualizado para ${PLAN_LABELS[pending]}!`);
    } finally {
      setPending(null);
    }
  };

  const plans: {
    id: UserPlan;
    name: string;
    price: string;
    features: string[];
    highlight?: boolean;
  }[] = [
    {
      id: "starter",
      name: "Starter",
      price: "R$ 99",
      features: ["1 loja", "300 pedidos/mês", "Integrações básicas"],
    },
    {
      id: "pro",
      name: "Pro",
      price: "R$ 249",
      features: [
        "5 lojas",
        "Pedidos ilimitados",
        "Todas as automações",
        "Suporte prioritário",
      ],
      highlight: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Sob consulta",
      features: ["Lojas ilimitadas", "API dedicada", "Gerente de conta"],
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = profile.plan === p.id;
          return (
            <Card
              key={p.id}
              className={`flex flex-col p-6 ${
                p.highlight ? "border-primary ring-2 ring-primary/20" : ""
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
              <p className="mt-4 text-2xl font-semibold">
                {p.price}
                <span className="text-sm font-normal text-muted-foreground">
                  /mês
                </span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
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
                onClick={() => setPending(p.id)}
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
              {pending ? PLAN_LABELS[pending] : ""}?
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
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                otpauth,
              )}&size=200x200`}
              alt="QR Code 2FA"
              width={200}
              height={200}
            />
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