import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Zap, Timer, Flame, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: "Automações — Delivery Auto Pro" }] }),
  component: AutomationsPage,
});

function Row({ icon: Icon, title, desc, defaultOn = true, children }: { icon: any; title: string; desc: string; defaultOn?: boolean; children?: React.ReactNode }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        <Switch checked={on} onCheckedChange={setOn} />
      </div>
      {on && children && <div className="mt-4 border-t pt-4">{children}</div>}
    </Card>
  );
}

function AutomationsPage() {
  return (
    <div>
      <PageHeader title="Automações" description="Configure regras que executam ações automaticamente nos seus pedidos." actions={<Button size="sm" onClick={() => toast.success("Regras salvas")}>Salvar alterações</Button>} />
      <div className="grid gap-4 p-4 sm:p-8 lg:grid-cols-2">
        <Row icon={Zap} title="Autoaceite de pedidos" desc="Aceita automaticamente todo pedido recebido nos canais conectados.">
          <div className="grid gap-2">
            <Label className="text-xs">Aplicar em</Label>
            <div className="flex flex-wrap gap-2 text-xs">
              {["iFood", "Keeta", "99Food"].map((c) => (
                <label key={c} className="flex items-center gap-2 rounded-md border px-3 py-1.5"><input type="checkbox" defaultChecked /> {c}</label>
              ))}
            </div>
          </div>
        </Row>
        <Row icon={Timer} title="Tempo automático de preparo" desc="Define o tempo de preparo enviado ao cliente assim que o pedido entra.">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Mínimo (min)</Label><Input type="number" defaultValue={15} /></div>
            <div><Label className="text-xs">Máximo (min)</Label><Input type="number" defaultValue={35} /></div>
          </div>
        </Row>
        <Row icon={Flame} title="Marcar como pronto automaticamente" desc="Marca o pedido como pronto após o tempo de preparo configurado.">
          <div><Label className="text-xs">Após (min)</Label><Input type="number" defaultValue={20} /></div>
        </Row>
        <Row icon={ShieldCheck} title="Regras operacionais" desc="Pause pedidos automaticamente em horário de pico ou alta demanda." defaultOn={false}>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Pausa se fila &gt;</Label><Input type="number" defaultValue={25} /></div>
            <div><Label className="text-xs">Retomar após (min)</Label><Input type="number" defaultValue={10} /></div>
          </div>
        </Row>
      </div>
    </div>
  );
}