import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import logoAsset from "@/assets/logo.webp.asset.json";

type Search = {
  message?: string;
  redirect?: string;
  reason?: string;
};

export const Route = createFileRoute("/blocked")({
  head: () => ({ meta: [{ title: "Acesso bloqueado — Zero Tempo" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    message: typeof s.message === "string" ? s.message : undefined,
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
  component: BlockedPage,
});

function BlockedPage() {
  const { message, redirect, reason } = Route.useSearch();
  const navigate = useNavigate();

  const title =
    reason === "trial_expired"
      ? "Seu período de teste terminou"
      : reason === "payment_suspended"
        ? "Acesso suspenso"
        : "Acesso bloqueado";
  const body =
    message ||
    (reason === "trial_expired"
      ? "Seu período gratuito expirou. Renove para continuar."
      : reason === "payment_suspended"
        ? "Acesso suspenso. Regularize seu pagamento para continuar."
        : "Seu acesso foi bloqueado.");
  const ctaLabel =
    reason === "payment_suspended" ? "Regularizar pagamento" : "Renovar / Assinar";
  const target = redirect || "/checkout";

  function goCheckout() {
    if (target.startsWith("http")) {
      window.location.href = target;
    } else {
      navigate({ to: target });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src={logoAsset.url} alt="Zero Tempo" className="h-14 w-14 object-contain" />
          <div className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Acesso bloqueado
          </div>
        </div>
        <h1 className="text-center text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={goCheckout} className="w-full">
            {ctaLabel}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/login" })}
            className="w-full"
          >
            Voltar para login
          </Button>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dúvidas? Fale com{" "}
          <a
            href="mailto:suporte@zerotempodepreparo.com"
            className="font-medium text-primary hover:underline"
          >
            suporte@zerotempodepreparo.com
          </a>
        </p>
      </Card>
    </div>
  );
}