import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Painel Administrativo" }] }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div>
      <PageHeader title="Painel Administrativo" description="Gerencie a plataforma." />
      <div className="p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Usuários</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">—</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Restaurantes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">—</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Pedidos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">—</p></CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Menu Cardápios</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Clique em "Cardápios" no menu lateral para gerenciar cardápios entre lojas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
