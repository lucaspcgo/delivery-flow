import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { integrations as initial } from "@/lib/mock-data";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({ meta: [{ title: "Integrações — Delivery Auto Pro" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const [list, setList] = useState(initial);
  const toggle = (id: string) => {
    setList((p) => p.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)));
    const item = list.find((i) => i.id === id);
    toast.success(item?.connected ? `${item?.name} desconectado` : `${item?.name} conectado`);
  };
  return (
    <div>
      <PageHeader title="Integrações" description="Conecte seus marketplaces de delivery para centralizar os pedidos." />
      <div className="grid gap-4 p-4 sm:p-8 md:grid-cols-2 xl:grid-cols-3">
        {list.map((i) => (
          <Card key={i.id} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold text-white" style={{ background: i.color }}>
                {i.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{i.name}</h3>
                <Badge variant="outline" className={i.connected ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}>
                  {i.connected ? (<><CheckCircle2 className="mr-1 h-3 w-3" />Conectado</>) : "Não conectado"}
                </Badge>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">{i.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                <div><dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Pedidos</dt><dd className="font-semibold">{i.ordersToday}</dd></div>
                <div><dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Sync</dt><dd className="font-semibold truncate">{i.lastSync}</dd></div>
                <div><dt className="text-[10px] text-muted-foreground uppercase tracking-wider">API</dt><dd className="font-semibold">{i.apiStatus}</dd></div>
              </dl>
              <Button onClick={() => toggle(i.id)} variant={i.connected ? "outline" : "default"} className="mt-5 w-full">
                {i.connected ? "Desconectar" : "Conectar"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}