import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAdminSettings, updateAdminSetting } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    getAdminSettings()
      .then((data) => {
        const map: Record<string, string> = {};
        (Array.isArray(data) ? data : []).forEach((s) => { map[s.key] = s.value ?? ""; });
        setValues(map);
      })
      .catch(() => setValues({}))
      .finally(() => setLoading(false));
  }, []);

  const setVal = (k: string, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const save = async (key: string) => {
    try {
      await updateAdminSetting(key, values[key] ?? "");
      toast.success("Configuração salva!");
    } catch {}
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const gateway = values["payment_gateway"] ?? "mercadopago";

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configurações de Pagamento</h1>
        <p className="text-sm text-slate-500">Gateways e preços dos planos</p>
      </div>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Gateway de Pagamento Ativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            value={gateway}
            onValueChange={(v) => setVal("payment_gateway", v)}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="mercadopago" id="mp" />
              <Label htmlFor="mp">Mercado Pago</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="stripe" id="st" />
              <Label htmlFor="st">Stripe</Label>
            </div>
          </RadioGroup>
          <Button onClick={() => save("payment_gateway")}>Salvar</Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader><CardTitle>Mercado Pago</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="Public Key" k="mp_public_key" values={values} setVal={setVal} onSave={save} />
          <FieldRow label="Access Token" k="mp_access_token" values={values} setVal={setVal} onSave={save} secret />
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader><CardTitle>Stripe</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="Public Key" k="stripe_public_key" values={values} setVal={setVal} onSave={save} />
          <FieldRow label="Secret Key" k="stripe_secret_key" values={values} setVal={setVal} onSave={save} secret />
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader><CardTitle>Preços dos Planos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="Starter (R$)" k="plan_price_starter" values={values} setVal={setVal} onSave={save} type="number" />
          <FieldRow label="Pro (R$)" k="plan_price_pro" values={values} setVal={setVal} onSave={save} type="number" />
          <FieldRow label="Enterprise (R$)" k="plan_price_enterprise" values={values} setVal={setVal} onSave={save} type="number" />
        </CardContent>
      </Card>
    </div>
  );
}

function FieldRow({
  label,
  k,
  values,
  setVal,
  onSave,
  secret,
  type,
}: {
  label: string;
  k: string;
  values: Record<string, string>;
  setVal: (k: string, v: string) => void;
  onSave: (k: string) => void;
  secret?: boolean;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input
          type={secret ? "password" : type ?? "text"}
          value={values[k] ?? ""}
          onChange={(e) => setVal(k, e.target.value)}
        />
      </div>
      <Button onClick={() => onSave(k)}>Salvar</Button>
    </div>
  );
}