import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { login, isAuthenticated } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import logoAsset from "@/assets/logo.webp.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Zero Tempo" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [blockType, setBlockType] = useState<
    "trial_expired" | "payment_suspended" | null
  >(null);
  const [blockMessage, setBlockMessage] = useState<string>("");

  useEffect(() => {
    if (isAuthenticated()) {
      navigate({ to: "/dashboard" });
      return;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("trial_expired") === "1") {
        setBlockType("trial_expired");
        setBlockMessage("Seu período gratuito de 7 dias expirou");
      } else if (params.get("payment_suspended") === "1") {
        setBlockType("payment_suspended");
        setBlockMessage("Acesso suspenso. Regularize seu pagamento.");
      }
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setBlockType(null);
    try {
      await login(email, password);
      navigate({ to: "/dashboard" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        const p = (err.payload ?? {}) as Record<string, unknown>;
        if (p.trial_expired === true || p.code === "trial_expired") {
          setBlockType("trial_expired");
          setBlockMessage(
            typeof p.message === "string"
              ? p.message
              : "Seu período gratuito de 7 dias expirou",
          );
          return;
        }
        if (p.payment_suspended === true || p.code === "payment_suspended") {
          setBlockType("payment_suspended");
          setBlockMessage(
            typeof p.message === "string"
              ? p.message
              : "Acesso suspenso. Regularize seu pagamento.",
          );
          return;
        }
      }
      toast.error("Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src={logoAsset.url} alt="Zero Tempo" className="h-14 w-14 object-contain" />
          <div className="text-center">
            <h1 className="text-lg font-semibold">Zero Tempo</h1>
            <p className="text-sm text-muted-foreground">Entrar no painel</p>
          </div>
        </div>
        {blockType && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="font-medium">{blockMessage}</p>
                <Button
                  size="sm"
                  className="mt-3 bg-red-600 text-white hover:bg-red-700"
                  onClick={() => navigate({ to: "/checkout" })}
                >
                  {blockType === "trial_expired"
                    ? "Assinar um plano"
                    : "Ir para pagamento"}
                </Button>
              </div>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
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
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Não tem conta?{" "}
            <a href="/register" className="font-medium text-primary hover:underline">
              Crie grátis
            </a>
          </p>
          <p>
            Quer assinar um plano?{" "}
            <a href="/checkout" className="font-medium text-primary hover:underline">
              Assine agora
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}