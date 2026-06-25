import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getPlans,
  createCheckout,
  confirmPayment,
  authToken,
  type CheckoutPlan,
  type CheckoutCreateResponse,
} from "@/lib/api";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Assinar — Delivery Auto Pro" }] }),
  component: CheckoutPage,
});

type Step = 1 | 2 | 3 | 4;

const FALLBACK_PLANS: CheckoutPlan[] = [
  {
    id: "starter",
    key: "starter",
    name: "Starter",
    price: 99,
    features: [
      "Até 1 restaurante",
      "Integração com iFood e 99Food",
      "Pedidos em tempo real",
      "Suporte por email",
    ],
  },
  {
    id: "pro",
    key: "pro",
    name: "Pro",
    price: 249,
    highlighted: true,
    features: [
      "Até 5 restaurantes",
      "Todas as integrações",
      "Automações ilimitadas",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
  },
  {
    id: "enterprise",
    key: "enterprise",
    name: "Enterprise",
    price: null,
    price_label: "Sob consulta",
    features: [
      "Restaurantes ilimitados",
      "API dedicada",
      "Gerente de conta",
      "SLA personalizado",
    ],
    cta: "Falar com vendas",
  },
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function Stepper({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Escolher Plano" },
    { n: 2, label: "Dados" },
    { n: 3, label: "Pagamento" },
  ];
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2">
      {items.map((it, idx) => {
        const active = step >= (it.n as Step);
        return (
          <div key={it.n} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted bg-background text-muted-foreground",
                )}
              >
                {it.n}
              </div>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {it.label}
              </span>
            </div>
            {idx < items.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded",
                  step > (it.n as Step) ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckoutPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [plans, setPlans] = useState<CheckoutPlan[]>(FALLBACK_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [checkout, setCheckout] = useState<CheckoutCreateResponse | null>(null);
  const [paymentResult, setPaymentResult] = useState<"success" | "failed" | null>(
    null,
  );
  const [secondsLeft, setSecondsLeft] = useState(30 * 60);

  const isLogged = typeof window !== "undefined" && !!authToken.get();

  useEffect(() => {
    getPlans()
      .then((data) => {
        if (Array.isArray(data) && data.length) setPlans(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== 3 || paymentResult) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [step, paymentResult]);

  const timerLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  function handleSelectPlan(plan: CheckoutPlan) {
    if (plan.key === "enterprise") {
      const msg = encodeURIComponent(
        "Olá! Tenho interesse no plano Enterprise do Delivery Auto Pro.",
      );
      window.open(`https://wa.me/5511999999999?text=${msg}`, "_blank");
      return;
    }
    setSelectedPlan(plan);
    if (isLogged) {
      void startCheckout(plan);
    } else {
      setStep(2);
    }
  }

  async function startCheckout(plan: CheckoutPlan, userData?: {
    name: string;
    email: string;
    password: string;
  }) {
    setSubmitting(true);
    try {
      const res = await createCheckout({
        plan: plan.key,
        ...(userData ?? {}),
      });
      setCheckout(res);
      setStep(3);
      setSecondsLeft(30 * 60);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/email/i.test(message) && /cadastrad/i.test(message)) {
        toast.error("Email já cadastrado", {
          description: "Faça login para continuar.",
        });
      } else {
        toast.error("Não foi possível iniciar o checkout", {
          description: message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitData(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) return;
    if (password !== confirmPwd) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (!acceptTerms) {
      toast.error("Você precisa aceitar os termos de uso");
      return;
    }
    await startCheckout(selectedPlan, { name, email, password });
  }

  async function handleConfirmPayment() {
    if (!checkout) return;
    setSubmitting(true);
    try {
      const res = await confirmPayment({ invoice_id: checkout.invoice_id });
      if (res.status === "paid") {
        if (res.token) {
          window.localStorage.setItem("auth_token", res.token);
        }
        if (res.user) {
          window.localStorage.setItem("auth_user", JSON.stringify(res.user));
        }
        setPaymentResult("success");
      } else {
        setPaymentResult("failed");
      }
    } catch {
      setPaymentResult("failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Delivery Auto Pro
          </h1>
        </div>

        {!paymentResult && (
          <div className="mb-10">
            <Stepper step={step} />
          </div>
        )}

        {paymentResult === "success" ? (
          <Card className="mx-auto max-w-md rounded-2xl p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Pagamento confirmado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Seu acesso ao plano {selectedPlan?.name} foi liberado.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              Acessar o painel
            </Button>
          </Card>
        ) : paymentResult === "failed" ? (
          <Card className="mx-auto max-w-md rounded-2xl p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <X className="h-9 w-9 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold">Pagamento não identificado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifique se o PIX foi enviado corretamente.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => setPaymentResult(null)}
            >
              Tentar novamente
            </Button>
          </Card>
        ) : step === 1 ? (
          <div>
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold">Escolha seu plano</h2>
              <p className="mt-2 text-muted-foreground">
                Comece a gerenciar seus pedidos de delivery hoje
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan) => {
                const highlighted = plan.highlighted || plan.key === "pro";
                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl p-6 shadow-sm",
                      highlighted && "border-2 border-primary shadow-md",
                    )}
                  >
                    {highlighted && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                        Mais popular
                      </Badge>
                    )}
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <div className="mt-3">
                      {plan.price != null ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">
                            {formatBRL(plan.price)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /mês
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xl font-bold">
                          {plan.price_label ?? "Sob consulta"}
                        </span>
                      )}
                    </div>
                    <ul className="mt-6 flex-1 space-y-3 text-sm">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-6 w-full"
                      variant={highlighted ? "default" : "outline"}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={submitting}
                    >
                      {plan.cta ??
                        (plan.key === "enterprise"
                          ? "Falar com vendas"
                          : "Selecionar")}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : step === 2 ? (
          <Card className="mx-auto max-w-md rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Seus dados</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Plano selecionado:{" "}
              <span className="font-medium text-foreground">
                {selectedPlan?.name}
              </span>
            </p>
            <form onSubmit={handleSubmitData} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  required
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={acceptTerms}
                  onCheckedChange={(v) => setAcceptTerms(v === true)}
                />
                <span className="text-muted-foreground">
                  Li e aceito os termos de uso
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Continuar para pagamento"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Já tenho conta?{" "}
                <a href="/login" className="font-medium text-primary hover:underline">
                  Entrar
                </a>
              </p>
            </form>
          </Card>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <Card className="rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Resumo do pedido</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-medium">{selectedPlan?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">
                    {selectedPlan?.price != null
                      ? formatBRL(selectedPlan.price)
                      : selectedPlan?.price_label}
                  </span>
                </div>
                {!isLogged && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome</span>
                      <span className="font-medium">{name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">{email}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card className="rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Forma de pagamento</h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border-2 border-primary p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">PIX</span>
                    <span className="text-xs text-muted-foreground">
                      Expira em {timerLabel}
                    </span>
                  </div>
                  <div className="mt-4 flex h-44 items-center justify-center rounded-lg bg-slate-100 p-4 text-center text-xs text-muted-foreground">
                    {checkout?.pix_qr_code ??
                      "QR Code será gerado ao configurar o gateway de pagamento no painel Admin → Config. API"}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Escaneie o QR Code com seu app bancário
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="pix-code" className="text-xs">
                      Código PIX copia e cola
                    </Label>
                    <Input
                      id="pix-code"
                      readOnly
                      value={checkout?.pix_copy_paste ?? ""}
                      placeholder="Disponível após configurar o gateway"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-dashed p-4 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Cartão de Crédito</span>
                    <span className="text-xs text-muted-foreground">Em breve</span>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                  onClick={handleConfirmPayment}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Já fiz o pagamento"
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}