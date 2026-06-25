import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Painel Administrativo — Zero Tempo" }] }),
  component: AdminPage,
});

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [tab] = useState("dashboard");

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("auth_user") || "{}");
      if (user?.is_admin) {
        setAuthorized(true);
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      window.location.href = "/login";
    }
  }, []);

  if (!authorized) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Painel Administrativo"
        description="Área administrativa do sistema."
      />
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Painel Administrativo
        </h1>
        <p className="mt-2 text-muted-foreground">Em construção...</p>
        <span className="sr-only">Aba atual: {tab}</span>
      </div>
    </div>
  );
}