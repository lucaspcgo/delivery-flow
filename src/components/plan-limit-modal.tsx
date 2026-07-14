import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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

type Detail = {
  error: "plan_upgrade_required" | "plan_limit_reached" | "account_inactive" | "trial_expired";
  capability?: "menu_sync" | "auto_accept";
  limit?: "restaurants" | "orders_monthly";
  max?: number;
  current?: number;
};

const CAP_LABEL: Record<string, string> = {
  menu_sync: "Sincronização de cardápio",
  auto_accept: "Aceite automático",
};

const LIMIT_LABEL: Record<string, string> = {
  restaurants: "restaurantes",
  orders_monthly: "pedidos por mês",
};

export function PlanLimitModal() {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<Detail>;
      if (ce.detail?.error) setDetail(ce.detail);
    };
    window.addEventListener("plan-gate", handler as EventListener);
    return () => window.removeEventListener("plan-gate", handler as EventListener);
  }, []);

  if (!detail) return null;

  const close = () => setDetail(null);
  const goPlans = () => {
    close();
    navigate({ to: "/checkout" });
  };

  let title = "";
  let body = "";
  let primary: { label: string; onClick: () => void } | null = null;

  if (detail.error === "plan_upgrade_required") {
    title = "Recurso não disponível";
    const cap = detail.capability ? CAP_LABEL[detail.capability] ?? detail.capability : "Este recurso";
    body = `${cap} está disponível apenas em planos superiores.`;
    primary = { label: "Fazer upgrade", onClick: goPlans };
  } else if (detail.error === "plan_limit_reached") {
    title = "Limite do plano atingido";
    const what = detail.limit ? LIMIT_LABEL[detail.limit] ?? detail.limit : "recursos";
    body = `Você atingiu o limite de ${detail.max ?? "?"} ${what}. Faça upgrade para aumentar a capacidade.`;
    primary = { label: "Fazer upgrade", onClick: goPlans };
  } else if (detail.error === "account_inactive") {
    title = "Conta inativa";
    body = "Sua conta está inativa no momento. Entre em contato com o suporte.";
    primary = {
      label: "Contatar suporte",
      onClick: () => {
        window.location.href = "mailto:suporte@zerotempodepreparo.com";
        close();
      },
    };
  } else if (detail.error === "trial_expired") {
    title = "Teste expirado";
    body = "Seu período de teste terminou. Assine um plano para continuar.";
    primary = { label: "Ver planos", onClick: goPlans };
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>Dispensar</AlertDialogCancel>
          {primary && (
            <AlertDialogAction onClick={primary.onClick}>{primary.label}</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}