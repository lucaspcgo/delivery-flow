import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { KEETA_ENABLED } from "@/lib/feature-flags";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  getReports,
  getRestaurants,
  getAdminUsers,
  type ReportsSummary,
  type ApiRestaurant,
  type AdminUser,
} from "@/lib/api";
import { hasStoredAdminAccess } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Zero Tempo" }] }),
  component: ReportsPage,
});

const PLATFORMS = [
  { value: "all", label: "Todas" },
  { value: "ifood", label: "iFood" },
  { value: "99food", label: "99Food" },
  { value: "keeta", label: "Keeta" },
].filter((p) => KEETA_ENABLED || p.value !== "keeta");

const PLATFORM_BADGE: Record<string, string> = {
  ifood: "bg-red-100 text-red-700 border-red-200",
  "99food": "bg-amber-100 text-amber-700 border-amber-200",
  keeta: "bg-violet-100 text-violet-700 border-violet-200",
};

const PLATFORM_LABEL: Record<string, string> = {
  ifood: "iFood",
  "99food": "99Food",
  keeta: "Keeta",
};

const STATUS_LABEL: Record<string, string> = {
  ready: "Pronto",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  "100": "Novo",
  pending: "Pendente",
};

function restaurantName(name?: string) {
  if (!name || name.trim() === "" || name === "Loja sem nome") {
    return "Loja não identificada";
  }
  return name;
}

const STATUS_COLOR: Record<string, string> = {
  ready: "#10b981",
  confirmed: "#3b82f6",
  cancelled: "#ef4444",
  "100": "#f59e0b",
};

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v || 0);
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(iso: string) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ReportsPage() {
  const [startDate, setStartDate] = useState(() => todayISO(-29));
  const [endDate, setEndDate] = useState(() => todayISO(0));
  const [platform, setPlatform] = useState("all");
  const [restaurantId, setRestaurantId] = useState("all");
  const [restaurants, setRestaurants] = useState<ApiRestaurant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userId, setUserId] = useState("all");
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const isAdmin = useMemo(() => hasStoredAdminAccess(), []);

  useEffect(() => {
    getRestaurants()
      .then(setRestaurants)
      .catch(() => setRestaurants([]));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    getAdminUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getReports({
        start_date: startDate,
        end_date: endDate,
        platform,
        restaurant_id: restaurantId,
        user_id: isAdmin ? userId : undefined,
      });
      setData(r);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, platform, restaurantId, userId, isAdmin]);

  // Carrega apenas no primeiro render — filtros são aplicados via botão
  // "Gerar Relatório" para evitar múltiplas chamadas enquanto o usuário ajusta.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await getReports({
          start_date: startDate,
          end_date: endDate,
          platform,
          restaurant_id: restaurantId,
        });
        if (alive) setData(r);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    const toastId = toast.loading("Gerando PDF...");
    const fmt = (iso: string) => {
      const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
    };
    const platformLabel =
      PLATFORMS.find((p) => p.value === platform)?.label ?? platform;
    const restaurantLabel =
      restaurantId === "all"
        ? "Todos"
        : restaurants.find((r) => r.id === restaurantId)?.name ?? restaurantId;
    const userLabel = isAdmin
      ? userId === "all"
        ? "Todos"
        : users.find((u) => u.id === userId)?.name ?? userId
      : null;
    const generatedAt = new Date().toLocaleString("pt-BR");
    try {
      const [{ default: html2canvas }, { default: JsPDF }, autoTableMod] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => void }).default;
      const pdf = new JsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const marginX = 12;
      const marginTop = 10;
      const marginBottom = 12;
      const headerHeight = 22;
      const gapAfterHeader = 4;
      const contentWidth = pageWidth - marginX * 2;
      const contentTop = marginTop + headerHeight + gapAfterHeader;

      const drawHeader = () => {
        pdf.setDrawColor(226, 232, 240);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(marginX, marginTop, contentWidth, headerHeight, 2, 2, "FD");
        pdf.setTextColor(15, 23, 42);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text("Relatório", marginX + 5, marginTop + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Gerado em ${generatedAt}`, marginX + 5, marginTop + 12);
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(9);
        const rightX = marginX + contentWidth - 5;
        pdf.text(`Período: ${fmt(startDate)} — ${fmt(endDate)}`, rightX, marginTop + 7, {
          align: "right",
        });
        pdf.text(`Plataforma: ${platformLabel}`, rightX, marginTop + 12, { align: "right" });
        pdf.text(`Restaurante: ${restaurantLabel}`, rightX, marginTop + 17, { align: "right" });
      };

      const didDrawPage = () => drawHeader();

      let cursorY = contentTop;
      const ensureSpace = (h: number) => {
        if (cursorY + h > pageHeight - marginBottom) {
          pdf.addPage();
          drawHeader();
          cursorY = contentTop;
        }
      };
      const sectionTitle = (text: string) => {
        ensureSpace(10);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(text, marginX, cursorY);
        cursorY += 5;
      };

      drawHeader();

      // Resumo (texto selecionável)
      const resumoData = data?.resumo;
      sectionTitle("Resumo");
      autoTable(pdf, {
        startY: cursorY,
        margin: { left: marginX, right: marginX, top: contentTop, bottom: marginBottom },
        head: [["Métrica", "Valor"]],
        body: [
          ["Total de Pedidos", String(resumoData?.total_pedidos ?? 0)],
          ["Faturamento Total", formatBRL(resumoData?.faturamento_total ?? 0)],
          ["Ticket Médio", formatBRL(resumoData?.ticket_medio ?? 0)],
          ["Taxa de Aceite", `${(resumoData?.taxa_aceite ?? 0).toFixed(1)}%`],
          ["Aceitos", String(resumoData?.aceitos ?? 0)],
          ["Cancelados", String(resumoData?.cancelados ?? 0)],
          ["Taxa de Cancelamento", `${(resumoData?.taxa_cancelamento ?? 0).toFixed(1)}%`],
        ],
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        didDrawPage,
      });
      cursorY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

      // Aguarda fontes carregarem antes de renderizar para evitar reflow/blur
      if (
        typeof document !== "undefined" &&
        (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts
      ) {
        await (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready;
      }

      // Gráficos como imagem — captura em alta densidade (retina) usando PNG para
      // preservar linhas nítidas de gráficos vetoriais (SVG do Recharts).
      const captureScale = Math.max(3, (window.devicePixelRatio || 1) * 2);
      const captureChart = async (id: string) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const c = await html2canvas(el, {
          scale: captureScale,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          imageTimeout: 0,
          removeContainer: true,
          windowWidth: document.documentElement.clientWidth,
          windowHeight: document.documentElement.clientHeight,
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
        });
        return { data: c.toDataURL("image/png"), w: c.width, h: c.height };
      };
      const chartIds = ["pdf-chart-faturamento", "pdf-chart-hora", "pdf-chart-status"];
      for (const id of chartIds) {
        const img = await captureChart(id);
        if (!img) continue;
        const drawW = contentWidth;
        const drawH = (img.h * drawW) / img.w;
        ensureSpace(drawH + 4);
        pdf.addImage(img.data, "PNG", marginX, cursorY, drawW, drawH, undefined, "FAST");
        cursorY += drawH + 4;
      }

      // Desempenho por Plataforma
      const porPlataformaData = [...(data?.por_plataforma ?? [])].sort(
        (a, b) => b.pedidos - a.pedidos,
      );
      sectionTitle("Desempenho por Plataforma");
      autoTable(pdf, {
        startY: cursorY,
        margin: { left: marginX, right: marginX, top: contentTop, bottom: marginBottom },
        head: [["Plataforma", "Pedidos", "Faturamento", "Ticket Médio"]],
        body:
          porPlataformaData.length === 0
            ? [["Sem dados no período", "—", "—", "—"]]
            : porPlataformaData.map((p) => [
                PLATFORM_LABEL[p.platform] ?? p.platform,
                String(p.pedidos),
                formatBRL(p.faturamento),
                formatBRL(p.ticket_medio),
              ]),
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
        },
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        didDrawPage,
      });
      cursorY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

      // Top 10 Itens
      const topItens = (data?.top_itens ?? []).slice(0, 10);
      sectionTitle("Top 10 Itens Mais Pedidos");
      autoTable(pdf, {
        startY: cursorY,
        margin: { left: marginX, right: marginX, top: contentTop, bottom: marginBottom },
        head: [["#", "Item", "Qtd", "Valor Total"]],
        body:
          topItens.length === 0
            ? [["—", "Sem dados no período", "—", "—"]]
            : topItens.map((item, i) => [
                String(i + 1),
                item.nome,
                String(item.quantidade),
                formatBRL(item.valor_total),
              ]),
        columnStyles: {
          0: { cellWidth: 10, halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
        },
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        didDrawPage,
      });
      cursorY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

      // Desempenho por Restaurante
      const porRest = data?.por_restaurante ?? [];
      sectionTitle("Desempenho por Restaurante");
      const restHead = isAdmin
        ? [["Restaurante", "Plataforma", "Usuário", "Pedidos", "Faturamento"]]
        : [["Restaurante", "Plataforma", "Pedidos", "Faturamento"]];
      const restBody =
        porRest.length === 0
          ? [isAdmin ? ["Sem dados no período", "—", "—", "—", "—"] : ["Sem dados no período", "—", "—", "—"]]
          : porRest.map((r) =>
              isAdmin
                ? [
                    restaurantName(r.restaurante),
                    PLATFORM_LABEL[r.platform] ?? r.platform,
                    r.usuario ?? "—",
                    String(r.pedidos),
                    formatBRL(r.faturamento),
                  ]
                : [
                    restaurantName(r.restaurante),
                    PLATFORM_LABEL[r.platform] ?? r.platform,
                    String(r.pedidos),
                    formatBRL(r.faturamento),
                  ],
            );
      autoTable(pdf, {
        startY: cursorY,
        margin: { left: marginX, right: marginX, top: contentTop, bottom: marginBottom },
        head: restHead,
        body: restBody,
        columnStyles: isAdmin
          ? { 3: { halign: "right" }, 4: { halign: "right" } }
          : { 2: { halign: "right" }, 3: { halign: "right" } },
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        didDrawPage,
      });

      // Paginação no rodapé (após todo o conteúdo)
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          `Página ${p} de ${totalPages}`,
          pageWidth - marginX,
          pageHeight - 5,
          { align: "right" },
        );
      }

      pdf.save(`relatorio_${startDate}_a_${endDate}.pdf`);
      toast.success("PDF baixado com sucesso!", { id: toastId });
    } catch (err) {
      console.error("[reports] export pdf failed", err);
      toast.error("Não foi possível gerar o PDF.", { id: toastId });
    } finally {
      setExporting(false);
    }
  }, [startDate, endDate, platform, restaurantId, restaurants, data, isAdmin]);

  const resumo = data?.resumo;

  const taxaAceiteTone = useMemo(() => {
    const v = resumo?.taxa_aceite ?? 0;
    if (v >= 90) return "text-emerald-600";
    if (v >= 70) return "text-amber-600";
    return "text-red-600";
  }, [resumo]);

  const porHoraMax = Math.max(1, ...(data?.por_hora ?? []).map((h) => h.pedidos));
  const topItensMax = Math.max(
    1,
    ...(data?.top_itens ?? []).map((i) => i.quantidade),
  );
  const porPlataforma = [...(data?.por_plataforma ?? [])].sort(
    (a, b) => b.pedidos - a.pedidos,
  );

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Indicadores operacionais e financeiros."
        actions={
          <Button variant="outline" onClick={handleExportPdf} disabled={exporting || loading}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Gerando..." : "Exportar PDF"}
          </Button>
        }
      />

      <div ref={reportRef} className="space-y-6 bg-background p-4 sm:p-8">
        {/* Filtros */}
        <Card className="p-4">
          <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Data início</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-[160px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Data fim</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-[160px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Plataforma</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Restaurante</label>
              <Select value={restaurantId} onValueChange={setRestaurantId}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                <label className="text-xs font-medium text-muted-foreground">Usuário</label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="w-full sm:w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={load} disabled={loading} className="col-span-2 w-full sm:col-span-1 sm:w-auto">
              {loading ? "Carregando..." : "Gerar Relatório"}
            </Button>
          </div>
        </Card>

        {/* Cards principais */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total de Pedidos
            </p>
            <p className="mt-2 text-2xl font-bold">
              {loading ? <Skeleton className="h-7 w-16" /> : resumo?.total_pedidos ?? 0}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Faturamento Total
            </p>
            <p className="mt-2 text-2xl font-bold">
              {loading ? <Skeleton className="h-7 w-24" /> : formatBRL(resumo?.faturamento_total ?? 0)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Ticket Médio
            </p>
            <p className="mt-2 text-2xl font-bold">
              {loading ? <Skeleton className="h-7 w-20" /> : formatBRL(resumo?.ticket_medio ?? 0)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Taxa de Aceite
            </p>
            <p className={cn("mt-2 text-2xl font-bold", taxaAceiteTone)}>
              {loading ? <Skeleton className="h-7 w-16" /> : `${(resumo?.taxa_aceite ?? 0).toFixed(1)}%`}
            </p>
          </Card>
        </div>

        {/* Cards secundários */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
          <Card className="flex items-center justify-between p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Aceitos
              </p>
              <p className="mt-2 text-2xl font-bold">{resumo?.aceitos ?? 0}</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              ✓
            </Badge>
          </Card>
          <Card className="flex items-center justify-between p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cancelados
              </p>
              <p className="mt-2 text-2xl font-bold">{resumo?.cancelados ?? 0}</p>
            </div>
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">✕</Badge>
          </Card>
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Taxa de Cancelamento
            </p>
            <p className="mt-2 text-2xl font-bold">
              {(resumo?.taxa_cancelamento ?? 0).toFixed(1)}%
            </p>
          </Card>
        </div>

        {/* Faturamento por dia */}
        <Card id="pdf-chart-faturamento" className="p-5">
          <h3 className="text-sm font-semibold">Faturamento por Dia</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Receita e quantidade de pedidos no período
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={(data?.por_dia ?? []).map((d) => ({
                  ...d,
                  label: formatDayLabel(d.dia),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name) =>
                    name === "faturamento" ? formatBRL(value) : value
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="right" dataKey="pedidos" fill="#cbd5e1" name="Pedidos" />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="faturamento"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name="Faturamento"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Pedidos por hora + Status */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card id="pdf-chart-hora" className="p-5">
            <h3 className="text-sm font-semibold">Pedidos por Hora</h3>
            <p className="mb-4 text-xs text-muted-foreground">Distribuição horária</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data?.por_hora ?? []).map((h) => ({ ...h, label: `${h.hora}h` }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="pedidos" radius={[4, 4, 0, 0]}>
                    {(data?.por_hora ?? []).map((h, i) => {
                      const intensity = h.pedidos / porHoraMax;
                      const alpha = 0.35 + intensity * 0.65;
                      return <Cell key={i} fill={`rgba(59,130,246,${alpha.toFixed(2)})`} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card id="pdf-chart-status" className="p-5">
            <h3 className="text-sm font-semibold">Distribuição por Status</h3>
            <p className="mb-4 text-xs text-muted-foreground">Pedidos por estado final</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Pie
                    data={(data?.por_status ?? []).map((s) => ({
                      ...s,
                      statusLabel: STATUS_LABEL[s.status] ?? s.status,
                    }))}
                    dataKey="total"
                    nameKey="statusLabel"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {(data?.por_status ?? []).map((s, i) => (
                      <Cell key={i} fill={STATUS_COLOR[s.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Desempenho por plataforma */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Desempenho por Plataforma</h3>
          <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plataforma</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porPlataforma.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sem dados no período
                  </TableCell>
                </TableRow>
              )}
              {porPlataforma.map((p) => (
                <TableRow key={p.platform}>
                  <TableCell>
                    <Badge variant="outline" className={PLATFORM_BADGE[p.platform] ?? ""}>
                      {PLATFORM_LABEL[p.platform] ?? p.platform}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{p.pedidos}</TableCell>
                  <TableCell className="text-right">{formatBRL(p.faturamento)}</TableCell>
                  <TableCell className="text-right">{formatBRL(p.ticket_medio)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>

        {/* Top 10 itens */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Top 10 Itens Mais Pedidos</h3>
          <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-[35%]">Volume</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.top_itens ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Sem dados no período
                  </TableCell>
                </TableRow>
              )}
              {(data?.top_itens ?? []).slice(0, 10).map((item, i) => (
                <TableRow key={`${item.nome}-${i}`}>
                  <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>
                    <Progress value={(item.quantidade / topItensMax) * 100} className="h-2" />
                  </TableCell>
                  <TableCell className="text-right">{item.quantidade}</TableCell>
                  <TableCell className="text-right">{formatBRL(item.valor_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>

        {/* Desempenho por restaurante */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Desempenho por Restaurante</h3>
          <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurante</TableHead>
                <TableHead>Plataforma</TableHead>
                {isAdmin && <TableHead>Usuário</TableHead>}
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.por_restaurante ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Sem dados no período
                  </TableCell>
                </TableRow>
              )}
              {(data?.por_restaurante ?? []).map((r, i) => (
                <TableRow key={`${r.restaurante}-${i}`}>
                  <TableCell className="font-medium">{restaurantName(r.restaurante)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PLATFORM_BADGE[r.platform] ?? ""}>
                      {PLATFORM_LABEL[r.platform] ?? r.platform}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-muted-foreground">
                      {r.usuario ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">{r.pedidos}</TableCell>
                  <TableCell className="text-right">{formatBRL(r.faturamento)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}