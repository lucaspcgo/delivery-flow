import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Loader2, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getPlansPublic,
  createCheckout,
  getPaymentStatus,
  authToken,
  type DBPlan,
  type CheckoutCreateResponse,
  formatPlanPrice,
} from "@/lib/api";
import { ApiError, safeLocalStorageSet } from "@/lib/api";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const checkoutSearchSchema = z.object({
  plan: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Assinar — Zero Tempo" }] }),
  validateSearch: zodValidator(checkoutSearchSchema),
  component: CheckoutPage,
});

type Step = 1 | 2 | 3 | 4;

const FALLBACK_PLANS: DBPlan[] = [];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getPlanKey(plan: DBPlan) {
  return plan.slug || plan.id;
}

function planButtonLabel(plan: DBPlan) {
  if (plan.is_free) return "Começar grátis";
  if (plan.price === 0) return "Falar com vendas";
  return "Selecionar";
}

function maskCpfCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function isValidDocLength(raw: string): boolean {
  const n = raw.replace(/\D/g, "").length;
  return n === 11 || n === 14;
}

async function copyToClipboard(text: string, label = "Código") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  } catch {
    toast.error("Falha ao copiar");
  }
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
  const { plan: planFromSearch } = Route.useSearch();
  const [step, setStep] = useState<Step>(1);
  const [plans, setPlans] = useState<DBPlan[]>(FALLBACK_PLANS);
  const [selectedPlan, setSelectedPlan] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [docValue, setDocValue] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [checkout, setCheckout] = useState<CheckoutCreateResponse | null>(null);
  const [paymentResult, setPaymentResult] = useState<"success" | "failed" | null>(
    null,
  );
  const [payMethod, setPayMethod] = useState<"pix" | "boleto">("pix");
  const [secondsLeft, setSecondsLeft] = useState(30 * 60);

  const isLogged = typeof window !== "undefined" && !!authToken.get();

  const selectedPlanDetails = useMemo(
    () => plans.find((plan) => getPlanKey(plan) === selectedPlan) ?? null,
    [plans, selectedPlan],
  );

  useEffect(() => {
    getPlansPublic()
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          const sorted = [...data]
            .filter((p) => p.active !== false && p.is_free !== true)
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
          setPlans(sorted);
        }
      })
      .catch(() => {});
  }, []);

  // Pré-seleção via ?plan=<slug>: se o usuário já está logado, inicia o
  // checkout automaticamente para o plano escolhido nas Configurações.
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (autoStarted) return;
    if (!planFromSearch) return;
    if (!plans.length) return;
    const match = plans.find((p) => getPlanKey(p) === planFromSearch);
    if (!match) return;
    setSelectedPlan(getPlanKey(match));
    setAutoStarted(true);
    // Sempre passamos pela etapa 2 (o CPF/CNPJ é obrigatório inclusive
    // para quem já está logado).
    if (!match.is_free && match.price >= 0) {
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, planFromSearch, autoStarted]);

  useEffect(() => {
    if (step !== 3 || paymentResult) return;
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step, paymentResult, secondsLeft]);

  const timerLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  function handleSelectPlan(plan: DBPlan) {
    const planKey = getPlanKey(plan);
    if (!plan.is_free && plan.price === 0) {
      const msg = encodeURIComponent(
        `Olá! Tenho interesse no plano ${plan.name} do Zero Tempo.`,
      );
      window.open(`https://wa.me/5511999999999?text=${msg}`, "_blank");
      return;
    }
    setSelectedPlan(planKey);
    setStep(2);
  }

  async function startCheckout(
    plan: string,
    document: string,
    userData?: { name: string; email: string; password: string },
  ) {
    setSubmitting(true);
    try {
      const body: Parameters<typeof createCheckout>[0] = userData
        ? {
            plan,
            name: userData.name,
            email: userData.email,
            password: userData.password,
            document,
          }
        : { plan, document };
      const res = await createCheckout(body);
      // Plano gratuito: API retorna type="free_trial" com token+user → auto-login
      if (res.type === "free_trial" && res.token && res.user) {
        const okA = safeLocalStorageSet("auth_token", res.token);
        const okB = safeLocalStorageSet("auth_user", JSON.stringify(res.user));
        if (!okA || !okB) {
          toast.error("Não foi possível salvar sua sessão.", {
            description: "Verifique se cookies/armazenamento estão habilitados.",
          });
          return;
        }
        toast.success("Conta criada!", {
          description: "Seu teste grátis de 7 dias começou.",
        });
        navigate({ to: "/dashboard" });
        return;
      }
      setCheckout(res);
      setStep(3);
      setSecondsLeft(30 * 60);
    } catch (err) {
      console.error("[checkout] erro ao criar checkout:", err);
      let title = "Não foi possível iniciar o checkout";
      let description = "Erro desconhecido. Tente novamente em instantes.";
      let status: number | null = null;
      let payload: unknown = null;

      if (err instanceof ApiError) {
        status = err.status;
        payload = err.payload;
        const p = (payload ?? {}) as Record<string, unknown>;
        const apiMsg =
          (typeof p.message === "string" && p.message) ||
          (typeof p.error === "string" && p.error) ||
          (typeof p.detail === "string" && p.detail) ||
          (Array.isArray(p.errors) && p.errors.length
            ? p.errors
                .map((e) =>
                  typeof e === "string"
                    ? e
                    : e && typeof e === "object" && "message" in e
                      ? String((e as { message: unknown }).message)
                      : JSON.stringify(e),
                )
                .join(" • ")
            : null) ||
          err.message;

        // Email já usou trial grátis
        if (
          /e-?mail.*(já|ja).*(utiliz|usad)/i.test(apiMsg) ||
          /already.*used.*trial/i.test(apiMsg) ||
          p.code === "trial_email_used"
        ) {
          toast.error("Este email já utilizou o período gratuito.", {
            description: "Escolha um plano pago.",
            duration: 8000,
          });
          return;
        }

        if (status === 0) {
          title = "Erro de conexão";
          description =
            "Não foi possível contatar a API. Verifique sua internet ou tente novamente.";
        } else if (status === 400 || status === 422) {
          title = "Dados inválidos";
          description = apiMsg;
        } else if (status === 401 || status === 403) {
          title = "Não autorizado";
          description = apiMsg;
        } else if (status === 404) {
          title = "Endpoint não encontrado";
          description = `A rota /checkout/create não existe na API (${apiMsg}).`;
        } else if (status === 409) {
          title = "Email já cadastrado";
          description = apiMsg || "Faça login para continuar.";
        } else if (status >= 500) {
          title = `Erro do servidor (${status})`;
          description = apiMsg;
        } else {
          description = `[${status}] ${apiMsg}`;
        }

        if (/email/i.test(apiMsg) && /cadastrad|exist|registered/i.test(apiMsg)) {
          title = "Email já cadastrado";
          description = "Faça login para continuar.";
        }
      } else if (err instanceof Error) {
        description = err.message;
      }

      toast.error(title, { description, duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitData(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!isValidDocLength(docValue)) {
      toast.error("Informe um CPF ou CNPJ válido");
      return;
    }
    if (!isLogged && password !== confirmPwd) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (!acceptTerms) {
      toast.error("Você precisa aceitar os termos de uso");
      return;
    }
    const doc = docValue.replace(/\D/g, "");
    if (isLogged) {
      await startCheckout(selectedPlan, doc);
    } else {
      await startCheckout(selectedPlan, doc, { name, email, password });
    }
  }

  // Polling: aguarda pagamento (a cada 8s) e busca pix_code se ainda não veio
  // (a cada 5s). Também roda no intervalo mais curto para pegar o Pix rápido.
  useEffect(() => {
    if (step !== 3 || paymentResult) return;
    const invoiceId = checkout?.invoice?.id ?? checkout?.invoice_id;
    if (!invoiceId) return;
    const needsPix = !checkout?.pix_code && !checkout?.pix_copy_paste;
    const interval = needsPix ? 5000 : 8000;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const res = await getPaymentStatus(invoiceId);
        if (cancelled) return;
        // Atualiza campos que possam ter chegado depois (pix_code, etc.)
        setCheckout((prev) =>
          prev
            ? {
                ...prev,
                pix_code: res.pix_code ?? prev.pix_code ?? prev.pix_copy_paste,
                pix_copy_paste:
                  res.pix_code ?? prev.pix_copy_paste ?? prev.pix_code,
                boleto_url: res.boleto_url ?? prev.boleto_url,
                digitable: res.digitable ?? prev.digitable,
              }
            : prev,
        );
        if (res.status === "paid") {
          if (res.token) safeLocalStorageSet("auth_token", res.token);
          if (res.user)
            safeLocalStorageSet("auth_user", JSON.stringify(res.user));
          setPaymentResult("success");
        }
      } catch {
        /* silencia — próximo tick tenta de novo */
      }
    }, interval);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, paymentResult, checkout?.invoice_id, checkout?.pix_code, checkout?.pix_copy_paste]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Zero Tempo
          </h1>
        </div>

        {!paymentResult && (
          <div className="mb-10">
            <Stepper step={step} />
          </div>
        )}

        {!paymentResult && step === 1 && (
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Quer testar antes?{" "}
            <a href="/register" className="font-medium text-primary hover:underline">
              Crie uma conta grátis
            </a>
          </p>
        )}

        {paymentResult === "success" ? (
          <Card className="mx-auto max-w-md rounded-2xl p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Pagamento confirmado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Seu acesso ao plano {selectedPlanDetails?.name} foi liberado.
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
                const highlighted = plan.popular;
                const isContactSales = !plan.is_free && plan.price === 0;
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
                      <span
                        className={cn(
                          "text-3xl font-bold",
                          plan.is_free && "text-green-600",
                        )}
                      >
                        {formatPlanPrice(plan)}
                      </span>
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
                      className={cn(
                        "mt-6 w-full",
                        plan.is_free && "bg-green-600 text-white hover:bg-green-700",
                      )}
                      variant={
                        plan.is_free ? "default" : highlighted ? "default" : "outline"
                      }
                      onClick={() => handleSelectPlan(plan)}
                      disabled={submitting}
                    >
                      {isContactSales ? "Falar com vendas" : planButtonLabel(plan)}
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
                {selectedPlanDetails?.name}
              </span>
            </p>
            {selectedPlanDetails?.is_free && (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                Teste grátis por 7 dias. Após o período, será necessário
                assinar um plano pago.
              </div>
            )}
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
                  <span className="font-medium">{selectedPlanDetails?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">
                    {selectedPlanDetails?.is_free
                      ? "Grátis"
                      : selectedPlanDetails && selectedPlanDetails.price > 0
                        ? formatBRL(selectedPlanDetails.price)
                        : "Sob consulta"}
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