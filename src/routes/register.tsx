import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { createCheckout, ApiError, safeLocalStorageSet } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import logoAsset from "@/assets/logo.webp.asset.json";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Criar conta — Zero Tempo" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) navigate({ to: "/dashboard" });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPwd) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (!acceptTerms) {
      toast.error("Você precisa aceitar os termos de uso");
      return;
    }
    setLoading(true);
    try {
      const res = await createCheckout({ plan: "free", name, email, password });
      if (res.type === "free_trial" && res.token && res.user) {
        const okA = safeLocalStorageSet("auth_token", res.token);
        const okB = safeLocalStorageSet("auth_user", JSON.stringify(res.user));
        if (!okA || !okB) {
          toast.error("Não foi possível salvar sua sessão.", {
            description: "Habilite cookies/armazenamento e tente novamente.",
          });
          return;
        }
        toast.success("Conta criada!", {
          description: "Seu teste grátis de 7 dias começou.",
        });
        navigate({ to: "/dashboard" });
        return;
      }
      toast.error("Não foi possível criar a conta", {
        description: "Resposta inesperada da API.",
      });
    } catch (err) {
      let title = "Não foi possível criar a conta";
      let description = "Tente novamente em instantes.";
      if (err instanceof ApiError) {
        const p = (err.payload ?? {}) as Record<string, unknown>;
        const apiMsg =
          (typeof p.message === "string" && p.message) ||
          (typeof p.error === "string" && p.error) ||
          err.message;
        if (
          /e-?mail.*(já|ja).*(utiliz|usad)/i.test(apiMsg) ||
          /already.*used.*trial/i.test(apiMsg) ||
          p.code === "trial_email_used"
        ) {
          toast.error("Este email já utilizou o período gratuito.", {
            description: "Escolha um plano pago.",
            duration: 8000,
          });
          setLoading(false);
          return;
        }
        if (err.status === 409) {
          title = "Email já cadastrado";
          description = "Faça login para continuar.";
        } else {
          description = apiMsg;
        }
      } else if (err instanceof Error) {
        description = err.message;
      }
      toast.error(title, { description, duration: 8000 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img
            src={logoAsset.url}
            alt="Zero Tempo"
            className="h-14 w-14 object-contain"
          />
          <div className="text-center">
            <h1 className="text-xl font-semibold">Crie sua conta grátis</h1>
            <p className="text-sm text-muted-foreground">
              Teste grátis por 7 dias. Sem cartão de crédito.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
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
              autoComplete="email"
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
              autoComplete="new-password"
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
              autoComplete="new-password"
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
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full bg-green-600 text-white hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              "Criar conta grátis"
            )}
          </Button>
        </form>
        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Já tem conta?{" "}
            <a href="/login" className="font-medium text-primary hover:underline">
              Faça login
            </a>
          </p>
          <p>
            Quer ver os planos pagos?{" "}
            <a href="/checkout" className="font-medium text-primary hover:underline">
              Veja nossos planos
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}