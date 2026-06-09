import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Timer, Flame, ShieldCheck, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: "Automações — Delivery Auto Pro" }] }),
  component: AutomationsPage,
});

function RuleCard({ 
  icon: Icon, 
  title, 
  desc, 
  defaultOn = true, 
  children,
  badge 
}: { 
  icon: any; 
  title: string; 
  desc: string; 
  defaultOn?: boolean; 
  children?: React.ReactNode;
  badge?: string;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <Card className={cn("overflow-hidden transition-all duration-300", on ? "ring-1 ring-primary shadow-md" : "opacity-75")}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
              on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">{title}</h3>
                {badge && <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">{badge}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          </div>
          <Switch checked={on} onCheckedChange={setOn} className="data-[state=checked]:bg-primary" />
        </div>
        
        {on && children && (
          <div className="mt-6 space-y-4 rounded-xl bg-muted/30 p-4 border border-dashed border-muted-foreground/20 animate-in fade-in slide-in-from-top-2 duration-300">
            {children}
          </div>
        )}
      </div>
      {on && (
        <div className="bg-primary/5 px-6 py-2 border-t border-primary/10 flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest">
          <CheckCircle2 className="h-3 w-3" /> Regra Ativa
        </div>
      )}
    </Card>
  );
}

function AutomationsPage() {
  return (
    <div className="min-h-screen bg-muted/10">
      <PageHeader 
        title="Fluxos de Automação" 
        description="Configure inteligência operacional para otimizar seu tempo de resposta." 
        actions={<Button className="shadow-lg shadow-primary/20" onClick={() => toast.success("Configurações salvas com sucesso!")}>Salvar Fluxos</Button>} 
      />
      
      <div className="grid gap-6 p-4 sm:p-8 lg:grid-cols-2 max-w-7xl mx-auto">
        <RuleCard 
          icon={Zap} 
          title="Aceite Instantâneo" 
          desc="Aprovar pedidos assim que chegarem no sistema."
          badge="Eficiência"
        >
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Marketplaces Aplicáveis</Label>
              <div className="flex flex-wrap gap-2">
                {["iFood", "Keeta", "99Food"].map((c) => (
                  <label key={c} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium cursor-pointer hover:border-primary transition-colors">
                    <input type="checkbox" defaultChecked className="accent-primary" /> {c}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Horário de Funcionamento</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Sempre ativo durante o expediente</span>
              </div>
            </div>
          </div>
        </RuleCard>

        <RuleCard 
          icon={Timer} 
          title="Timer de Preparo Inteligente" 
          desc="Configurar tempo de entrega automático para o cliente."
          badge="Operacional"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Mínimo (min)</Label>
              <Input type="number" defaultValue={15} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Máximo (min)</Label>
              <Input type="number" defaultValue={35} className="bg-background" />
            </div>
            <div className="col-span-2 text-[10px] text-muted-foreground italic flex items-center gap-1">
              <Info className="h-3 w-3" /> O tempo será ajustado conforme o volume de pedidos pendentes.
            </div>
          </div>
        </RuleCard>

        <RuleCard 
          icon={Flame} 
          title="Expedição Automática" 
          desc="Marcar pedido como pronto após tempo decorrido."
          badge="Automação"
        >
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Marcar como pronto após (min)</Label>
            <div className="flex items-center gap-3">
              <Input type="number" defaultValue={20} className="bg-background max-w-[100px]" />
              <span className="text-sm font-medium text-muted-foreground">minutos de preparo</span>
            </div>
          </div>
        </RuleCard>

        <RuleCard 
          icon={ShieldCheck} 
          title="Gestão de Sobrecarga" 
          desc="Pausar canais automaticamente se houver muitos pedidos." 
          defaultOn={false}
          badge="Segurança"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Pausa se fila &gt;</Label>
              <Input type="number" defaultValue={25} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Retomar após (min)</Label>
              <Input type="number" defaultValue={10} className="bg-background" />
            </div>
            <div className="col-span-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-900 text-[10px]">
              Esta regra evita atrasos excessivos pausando temporariamente as lojas no marketplace.
            </div>
          </div>
        </RuleCard>
      </div>
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
