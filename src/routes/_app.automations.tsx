import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getAutomations,
  updateAutomation,
  type AutomationRule,
} from "@/lib/api";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: "Automações — Zero Tempo" }] }),
  component: AutomationsPage,
});

const PLATFORM_META: Record<
  string,
  { label: string; bg: string; text: string; ring: string }
> = {
  ifood: { label: "iFood", bg: "bg-red-100", text: "text-red-700", ring: "ring-red-200" },
  "99food": { label: "99Food", bg: "bg-yellow-100", text: "text-yellow-800", ring: "ring-yellow-200" },
  keeta: { label: "Keeta", bg: "bg-green-100", text: "text-green-700", ring: "ring-green-200" },
  all: { label: "Todas", bg: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-200" },
};

function platformMeta(p: string) {
  return PLATFORM_META[p] ?? PLATFORM_META.all;
}

function AutomationCardSkeleton() {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </Card>
  );
}

function RuleCard({
  rule,
  onChange,
}: {
  rule: AutomationRule;
  onChange: (next: AutomationRule) => void;
}) {
  const meta = platformMeta(rule.platform);
  const [acceptDelay, setAcceptDelay] = useState<string>(
    String(rule.accept_delay_seconds ?? 0),
  );
  const [readyDelay, setReadyDelay] = useState<string>(
    String(rule.delay_seconds ?? 0),
  );
  const [enabled, setEnabled] = useState<boolean>(rule.enabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAcceptDelay(String(rule.accept_delay_seconds ?? 0));
    setReadyDelay(String(rule.delay_seconds ?? 0));
    setEnabled(rule.enabled);
  }, [rule.accept_delay_seconds, rule.delay_seconds, rule.enabled]);

  const dirty =
    enabled !== rule.enabled ||
    Math.max(0, Number(acceptDelay) || 0) !== (rule.accept_delay_seconds ?? 0) ||
    Math.max(0, Number(readyDelay) || 0) !== (rule.delay_seconds ?? 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        enabled,
        accept_delay_seconds: Math.max(0, Number(acceptDelay) || 0),
        delay_seconds: Math.max(0, Number(readyDelay) || 0),
      };
      const updated = await updateAutomation(rule.id, payload);
      onChange({ ...rule, ...updated, ...payload });
      toast.success("Automação salva!");
    } catch {
      toast.error("Não foi possível salvar a automação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className={cn(
        "p-6 transition-all bg-card rounded-xl shadow-sm",
        rule.enabled ? "ring-1 ring-primary/30" : "opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1",
              meta.bg,
              meta.text,
              meta.ring,
            )}
          >
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold truncate">{rule.name}</h3>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] uppercase tracking-wider font-bold",
                  rule.enabled
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {rule.enabled ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {rule.description}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={saving}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Tempo para ACEITAR (segundos)
          </Label>
          <Input
            type="number"
            min={0}
            value={acceptDelay}
            onChange={(e) => setAcceptDelay(e.target.value)}
            disabled={!enabled || saving}
            className="bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Tempo para marcar PRONTO (segundos)
          </Label>
          <Input
            type="number"
            min={0}
            value={readyDelay}
            onChange={(e) => setReadyDelay(e.target.value)}
            disabled={!enabled || saving}
            className="bg-background"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
        O pedido espera o tempo de <strong>ACEITE</strong>, é aceito, e depois
        espera o tempo de <strong>PRONTO</strong> para ser marcado como pronto.
      </p>

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </Card>
  );
}

function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAutomations();
      setRules(data);
    } catch (e) {
      setError("Não foi possível carregar as automações");
      toast.error("Erro ao carregar automações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRuleChange = (next: AutomationRule) => {
    setRules((prev) =>
      prev ? prev.map((r) => (r.id === next.id ? next : r)) : prev,
    );
  };

  return (
    <div className="min-h-screen bg-muted/10">
      <PageHeader
        title="Automações"
        description="Configure regras automáticas para seus pedidos"
      />

      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <Card className="p-5 bg-blue-50 border-blue-100">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Info className="h-5 w-5" />
            </div>
            <p className="text-sm text-blue-900 leading-relaxed">
              Quando ativada, a automação aceita pedidos automaticamente após o
              tempo configurado. Você ainda pode aceitar/recusar manualmente no
              painel de Pedidos.
            </p>
          </div>
        </Card>

        {loading && (
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <AutomationCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <Card className="p-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={load} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
          </Card>
        )}

        {!loading && !error && rules && rules.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma automação configurada.
          </Card>
        )}

        {!loading && !error && rules && rules.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onChange={handleRuleChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
