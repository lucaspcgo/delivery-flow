import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlarmClock,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Store,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ApiError,
  ifoodMerchant,
  type IfoodInterruption,
  type IfoodMerchantStatus,
  type IfoodMerchantValidation,
  type IfoodShift,
} from "@/lib/api";

// ---------- Tipos locais ----------

interface IfoodStoreOption {
  merchantId: string;
  name: string;
}

/** Última resposta (sucesso ou erro) de uma chamada da API, exibida na tela. */
interface ApiFeedback {
  ok: boolean;
  status: number;
  message: string;
  payload?: unknown;
}

const DAYS: Array<{ value: string; label: string }> = [
  { value: "MONDAY", label: "Segunda" },
  { value: "TUESDAY", label: "Terça" },
  { value: "WEDNESDAY", label: "Quarta" },
  { value: "THURSDAY", label: "Quinta" },
  { value: "FRIDAY", label: "Sexta" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
];

const dayLabel = (v: string) =>
  DAYS.find((d) => d.value === String(v).toUpperCase())?.label ?? v;

function toFeedback(err: unknown, fallback = "Falha inesperada"): ApiFeedback {
  if (err instanceof ApiError) {
    // 409 = conflito de período em pausas (regra de negócio do iFood)
    const message =
      err.status === 409 ? "Já existe pausa nesse período" : err.message;
    return { ok: false, status: err.status, message, payload: err.payload };
  }
  const message = err instanceof Error ? err.message : fallback;
  return { ok: false, status: 0, message };
}

/** Converte um valor de <input type="datetime-local"> para ISO-8601. */
function localToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function minutesToHuman(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "0min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : null, m ? `${m}min` : null].filter(Boolean).join(" ");
}

// ---------- Painel de resposta da API ----------

function ApiFeedbackPanel({ feedback }: { feedback: ApiFeedback | null }) {
  if (!feedback) return null;
  return (
    <div
      className={cn(
        "mt-3 rounded-lg border px-3 py-2 text-xs",
        feedback.ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <span className="font-semibold">
        {feedback.status ? `HTTP ${feedback.status}` : "Sem resposta"}
      </span>
      <span className="mx-1.5 opacity-50">•</span>
      <span className="break-words">{feedback.message}</span>
    </div>
  );
}

// ---------- Selo de estado ----------

const STATE_STYLES: Record<string, string> = {
  OK: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  WARNING: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  CLOSED: "bg-muted text-muted-foreground border-border",
  ERROR: "bg-destructive/15 text-destructive border-destructive/30",
};

function StateBadge({ state }: { state?: string }) {
  const key = String(state ?? "").toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
        STATE_STYLES[key] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {key || "DESCONHECIDO"}
    </span>
  );
}

// ---------- Error boundary local ----------

class StatusErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <section className="rounded-xl border p-4">
          <h3 className="text-sm font-semibold">1. Status da loja</h3>
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Não foi possível exibir o status desta loja:{" "}
            {this.state.error.message || "resposta inesperada da API."}
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

// ---------- Componente principal ----------

interface IfoodStoreManagerProps {
  stores: IfoodStoreOption[];
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export function IfoodStoreManager({
  stores,
  loading = false,
  onRefresh,
}: IfoodStoreManagerProps) {
  const [merchantId, setMerchantId] = useState<string>("");

  const selectedStore = useMemo(
    () => stores.find((s) => s.merchantId === merchantId) ?? null,
    [stores, merchantId],
  );

  useEffect(() => {
    if (merchantId && !stores.some((s) => s.merchantId === merchantId)) {
      setMerchantId("");
    }
  }, [merchantId, stores]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-[#EA1D2C]" />
          <div>
            <h2 className="text-base font-semibold">Gerenciar Loja iFood</h2>
            <p className="text-xs text-muted-foreground">
              Status, pausas e horários de funcionamento direto na API do iFood.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onRefresh?.()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Recarregar lojas
        </Button>
      </div>

      <div className="mt-4 max-w-md">
        <Label className="text-xs">Loja</Label>
        <Select value={merchantId} onValueChange={setMerchantId}>
          <SelectTrigger className="mt-1">
            <SelectValue
              placeholder={
                loading ? "Carregando lojas..." : "Selecione a loja iFood"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.merchantId} value={s.merchantId}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!loading && stores.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Nenhuma loja iFood com merchant_id encontrada. Conecte uma loja
            primeiro.
          </p>
        )}
        {selectedStore && (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            merchant_id: {selectedStore.merchantId}
          </p>
        )}
      </div>

      {merchantId && (
        <div className="mt-6 grid gap-4">
          <StatusErrorBoundary key={`st-${merchantId}`}>
            <StatusBlock merchantId={merchantId} />
          </StatusErrorBoundary>
          <InterruptionsBlock key={`in-${merchantId}`} merchantId={merchantId} />
          <OpeningHoursBlock key={`oh-${merchantId}`} merchantId={merchantId} />
        </div>
      )}
    </Card>
  );
}

// ---------- 1) STATUS ----------

function StatusBlock({ merchantId }: { merchantId: string }) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<IfoodMerchantStatus[] | null>(null);
  const [feedback, setFeedback] = useState<ApiFeedback | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await ifoodMerchant.status(merchantId);
      // A API pode responder um array, um objeto único ou um erro { error, code, details }.
      const maybeError = res as { error?: unknown; code?: unknown; details?: unknown };
      if (!Array.isArray(res) && maybeError?.error) {
        setEntries(null);
        setFeedback({
          ok: false,
          status: typeof maybeError.code === "number" ? maybeError.code : 0,
          message:
            typeof maybeError.error === "string"
              ? maybeError.error
              : "A API do iFood retornou um erro ao consultar o status.",
          payload: maybeError.details,
        });
        return;
      }
      const list: IfoodMerchantStatus[] = Array.isArray(res)
        ? res.filter((item): item is IfoodMerchantStatus => !!item && typeof item === "object")
        : res && typeof res === "object"
          ? [res]
          : [];
      setEntries(list);
      setFeedback({
        ok: true,
        status: 200,
        message: `${list.length} registro(s) de status retornado(s).`,
      });
    } catch (err) {
      setEntries(null);
      setFeedback(toFeedback(err, "Falha ao consultar status"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">1. Status da loja</h3>
        <Button size="sm" onClick={() => void fetchStatus()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Consultar status
        </Button>
      </div>

      {entries && entries.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          A API não retornou nenhum status para esta loja.
        </p>
      )}

      {entries && entries.length > 0 && (
        <div className="mt-4 grid gap-3">
          {entries.map((item, i) => (
            <StatusEntryCard key={`${String(item?.operation ?? "op")}-${i}`} item={item} />
          ))}
        </div>
      )}

      <ApiFeedbackPanel feedback={feedback} />
    </section>
  );
}

/**
 * Extrai texto renderizável de um valor desconhecido.
 * Objetos como { title, subtitle, description } são achatados nos seus textos.
 * Nunca retorna um objeto — evita "Objects are not valid as a React child".
 */
function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(safeText).filter(Boolean) as string[];
    return parts.length ? parts.join(" — ") : null;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const parts = [o.title, o.subtitle, o.description, o.message, o.code]
      .map((v) => (typeof v === "object" ? null : safeText(v)))
      .filter(Boolean) as string[];
    return parts.length ? parts.join(" — ") : null;
  }
  return null;
}

function StatusEntryCard({ item }: { item: IfoodMerchantStatus }) {
  const validations: IfoodMerchantValidation[] = Array.isArray(item?.validations)
    ? item.validations
    : [];

  const msg = (item?.message ?? null) as Record<string, unknown> | string | null;
  const messageLines =
    typeof msg === "string"
      ? [msg]
      : msg && typeof msg === "object"
        ? [safeText(msg?.title), safeText(msg?.subtitle), safeText(msg?.description)]
        : [];
  const lines = messageLines.filter(Boolean) as string[];
  const available = item?.available;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge state={safeText(item?.state) ?? undefined} />
        <Badge variant="outline" className="text-[11px]">
          {safeText(item?.operation) ?? "OPERAÇÃO —"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Disponível:{" "}
          <span className="font-semibold text-foreground">
            {available === true ? "Sim" : available === false ? "Não" : "—"}
          </span>
        </span>
      </div>

      {lines.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {lines.map((line, i) => (
            <p
              key={i}
              className={cn(
                "text-muted-foreground",
                i === 0 ? "text-sm font-medium text-foreground" : "text-xs",
              )}
            >
              {line}
            </p>
          ))}
        </div>
      )}

      {validations.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {validations.map((v, idx) => {
            const title =
              safeText(v?.title) ??
              safeText((v?.message as Record<string, unknown>)?.title) ??
              safeText(v?.code) ??
              safeText(v?.id) ??
              "Validação";
            const detail =
              safeText((v?.message as Record<string, unknown>)?.description) ??
              safeText(v?.message);
            return (
              <li
                key={safeText(v?.id) ?? idx}
                className="rounded-lg border bg-background px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={safeText(v?.state) ?? undefined} />
                  <span className="font-semibold">{title}</span>
                </div>
                {detail && detail !== title && (
                  <p className="mt-1 text-muted-foreground">{detail}</p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhuma validação retornada.
        </p>
      )}
    </div>
  );
}

// ---------- 2) PAUSAS ----------

function InterruptionsBlock({ merchantId }: { merchantId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [items, setItems] = useState<IfoodInterruption[] | null>(null);
  const [feedback, setFeedback] = useState<ApiFeedback | null>(null);

  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async (options?: { silent?: boolean }) => {
    setLoading(true);
    try {
      const res = await ifoodMerchant.listInterruptions(merchantId);
      const list = Array.isArray(res) ? res : (res?.interruptions ?? []);
      setItems(list);
      if (!options?.silent) {
        setFeedback({
          ok: true,
          status: 200,
          message: `${list.length} pausa(s) encontrada(s).`,
        });
      }
    } catch (err) {
      setItems(null);
      if (!options?.silent) setFeedback(toFeedback(err, "Falha ao listar pausas"));
    } finally {
      setLoading(false);
    }
  };

  // Carrega a lista automaticamente ao abrir / trocar de loja.
  useEffect(() => {
    setItems(null);
    setFeedback(null);
    void load({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  const create = async () => {
    const startIso = localToIso(start);
    const endIso = localToIso(end);
    if (!description.trim()) {
      setFeedback({ ok: false, status: 0, message: "Informe a descrição da pausa." });
      return;
    }
    if (!startIso || !endIso) {
      setFeedback({ ok: false, status: 0, message: "Informe início e fim válidos." });
      return;
    }
    if (new Date(endIso) <= new Date(startIso)) {
      setFeedback({ ok: false, status: 0, message: "O fim deve ser depois do início." });
      return;
    }
    setSaving(true);
    try {
      await ifoodMerchant.createInterruption(merchantId, {
        description: description.trim(),
        start: startIso,
        end: endIso,
      });
      setFeedback({ ok: true, status: 201, message: "Pausa criada" });
      setDescription("");
      setStart("");
      setEnd("");
      await load({ silent: true });
    } catch (err) {
      setFeedback(toFeedback(err, "Falha ao criar pausa"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await ifoodMerchant.removeInterruption(merchantId, id);
      setFeedback({ ok: true, status: 204, message: "Pausa removida" });
      await load({ silent: true });
    } catch (err) {
      setFeedback(toFeedback(err, "Falha ao remover pausa"));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <AlarmClock className="h-4 w-4" /> 2. Pausas (interrupções)
        </h3>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Listar pausas
        </Button>
      </div>

      {items && (
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">
                    Nenhuma pausa cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-[11px]">{it.id}</TableCell>
                  <TableCell className="text-xs">{it.description ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(it.start)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(it.end)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void remove(it.id)}
                      disabled={removing === it.id}
                    >
                      {removing === it.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remover
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4 rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-semibold">Criar pausa</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Manutenção da cozinha"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Início</Label>
            <Input
              type="datetime-local"
              step={60}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input
              type="datetime-local"
              step={60}
              min={start || undefined}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void create()} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar pausa
            </Button>
          </div>
        </div>
      </div>

      <ApiFeedbackPanel feedback={feedback} />
    </section>
  );
}

// ---------- 3) HORÁRIOS ----------

function OpeningHoursBlock({ merchantId }: { merchantId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shifts, setShifts] = useState<IfoodShift[] | null>(null);
  const [feedback, setFeedback] = useState<ApiFeedback | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await ifoodMerchant.openingHours(merchantId);
      const list: IfoodShift[] = Array.isArray(res) ? res : (res?.shifts ?? []);
      setShifts(
        list.map((s) => ({
          dayOfWeek: String(s.dayOfWeek ?? "MONDAY").toUpperCase(),
          start: String(s.start ?? "00:00:00").slice(0, 5),
          duration: Number(s.duration ?? 0),
        })),
      );
      setFeedback({
        ok: true,
        status: 200,
        message: `${list.length} turno(s) carregado(s).`,
      });
    } catch (err) {
      setShifts(null);
      setFeedback(toFeedback(err, "Falha ao carregar horários"));
    } finally {
      setLoading(false);
    }
  };

  const patchShift = (idx: number, patch: Partial<IfoodShift>) => {
    setShifts((prev) =>
      prev ? prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)) : prev,
    );
  };

  const addShift = () =>
    setShifts((prev) => [
      ...(prev ?? []),
      { dayOfWeek: "MONDAY", start: "08:00", duration: 600 },
    ]);

  const removeShift = (idx: number) =>
    setShifts((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));

  const save = async () => {
    if (!shifts) return;
    const invalid = shifts.some(
      (s) => !/^\d{2}:\d{2}$/.test(s.start) || !Number.isFinite(s.duration) || s.duration <= 0,
    );
    if (invalid) {
      setFeedback({
        ok: false,
        status: 0,
        message: "Verifique os turnos: hora no formato HH:MM e duração maior que 0.",
      });
      return;
    }
    setSaving(true);
    try {
      await ifoodMerchant.updateOpeningHours(
        merchantId,
        shifts.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          start: `${s.start}:00`,
          duration: Number(s.duration),
        })),
      );
      setFeedback({ ok: true, status: 200, message: "Horários atualizados com sucesso." });
      await load();
    } catch (err) {
      setFeedback(toFeedback(err, "Falha ao atualizar horários"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4" /> 3. Horários de funcionamento
        </h3>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Ver horários
        </Button>
      </div>

      {shifts && (
        <div className="mt-4 space-y-2">
          {shifts.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum turno cadastrado.</p>
          )}
          {shifts.map((s, idx) => (
            <div
              key={idx}
              className="grid items-end gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <div>
                <Label className="text-xs">Dia</Label>
                <Select
                  value={s.dayOfWeek}
                  onValueChange={(v) => patchShift(idx, { dayOfWeek: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={s.start}
                  onChange={(e) => patchShift(idx, { start: e.target.value })}
                  className="mt-1 w-32"
                />
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={s.duration}
                  onChange={(e) =>
                    patchShift(idx, { duration: Number(e.target.value) })
                  }
                  className="mt-1 w-32"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {dayLabel(s.dayOfWeek)} • {minutesToHuman(Number(s.duration))}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => removeShift(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={addShift}>
              <Plus className="h-4 w-4" /> Adicionar turno
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Atualizar horários
            </Button>
          </div>
        </div>
      )}

      <ApiFeedbackPanel feedback={feedback} />
    </section>
  );
}