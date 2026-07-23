import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPlansPublic, getPlansAdmin, formatPlanPrice, type DBPlan } from "@/lib/api";
import {
  Layers,
  Zap,
  Kanban,
  BarChart3,
  Code2,
  Headphones,
  Check,
  ChevronDown,
  Star,
  Menu,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zero Tempo — Gestão de Pedidos Inteligente para Restaurantes" },
      {
        name: "description",
        content:
          "Automatize pedidos do iFood e 99Food em um só lugar. Aumente vendas, reduza erros e gerencie tudo com Zero Tempo.",
      },
    ],
  }),
  component: LandingPage,
});

const BRAND = "#F8DA55";
const BRAND_DARK = "#D9BB3A";
const BG = "#0F1117";
const BG_2 = "#1a1d27";

const YT_VIDEO_ID = "FTrje4NmSxg";

/**
 * Detecta o aspect ratio real do vídeo do YouTube via oEmbed.
 * Retorna "9 / 16" (Short/vertical) ou "16 / 9" (horizontal).
 * Fallback: 16/9.
 */
function useYouTubeAspect(videoId: string): string {
  const [aspect, setAspect] = useState<string>("16 / 9");
  useEffect(() => {
    let alive = true;
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { width?: number; height?: number } | null) => {
        if (!alive || !data?.width || !data?.height) return;
        setAspect(data.height > data.width ? "9 / 16" : "16 / 9");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [videoId]);
  return aspect;
}

const features = [
  { icon: Layers, title: "Multi-Plataforma", desc: "iFood e 99Food em um único painel unificado." },
  { icon: Zap, title: "Auto-Accept", desc: "Aceite pedidos automaticamente em segundos, sem esforço." },
  { icon: Kanban, title: "Kanban Visual", desc: "Organize pedidos por status com drag-and-drop intuitivo." },
  { icon: BarChart3, title: "Relatórios", desc: "Métricas de vendas, performance e insights em tempo real." },
  { icon: Code2, title: "API Oficial", desc: "Temos as API oficial de cada delivery." },
  { icon: Headphones, title: "Suporte 24/7", desc: "Chat, email e telefone sempre que você precisar." },
];

const testimonials = [
  {
    quote: "Zero Tempo aumentou nossas vendas em 30% nos primeiros 2 meses. A automação mudou nossa operação.",
    name: "João Silva",
    role: "Pizzaria Bella, Goiânia",
  },
  {
    quote: "Finalmente posso gerenciar todas as plataformas sem estresse. A equipe ganhou horas por dia.",
    name: "Maria Santos",
    role: "Restaurante da Maria, São Paulo",
  },
];

const faqs = [
  { q: "Quais plataformas são suportadas?", a: "Atualmente integramos com iFood e 99Food. Novas plataformas chegam todo trimestre." },
  { q: "É realmente grátis por 7 dias?", a: "Sim! 7 dias de teste completo, sem cartão de crédito e sem compromisso." },
  { q: "Posso cancelar a qualquer momento?", a: "Claro. Cancelamento em 1 clique, sem multas ou penalidades." },
  { q: "Como funciona o suporte?", a: "Oferecemos chat 24/7, email e telefone. Contas PRO têm prioridade." },
  { q: "Minhas informações são seguras?", a: "Criptografia SSL, backups automáticos e total conformidade com a LGPD." },
];

function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [plans, setPlans] = useState<DBPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    const normalize = (list: DBPlan[] | null | undefined) =>
      (list ?? [])
        .filter((p) => p.active !== false)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    (async () => {
      try {
        const pub = await getPlansPublic().catch(() => [] as DBPlan[]);
        let result = normalize(pub);
        if (result.length === 0) {
          // Fallback: usa o mesmo endpoint do admin (apenas planos ativos)
          const all = await getPlansAdmin().catch(() => [] as DBPlan[]);
          result = normalize(all);
        }
        setPlans(result);
      } finally {
        setPlansLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ background: BG, color: "#fff" }} className="min-h-screen scroll-smooth">
      {/* NAVBAR */}
      <nav
        className="sticky top-0 z-50 backdrop-blur border-b"
        style={{ background: "rgba(15,17,23,0.85)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#top" className="text-xl font-extrabold tracking-tight" style={{ color: BRAND }}>
            Zero Tempo
          </a>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-white/70 hover:text-white">Características</a>
            <a href="#pricing" className="text-sm text-white/70 hover:text-white">Preços</a>
            <a href="#faq" className="text-sm text-white/70 hover:text-white">FAQ</a>
            <Link
              to="/register"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
              style={{ background: BRAND }}
            >
              Começar Agora
            </Link>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t px-6 py-4 md:hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex flex-col gap-3">
              <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm text-white/80">Características</a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="text-sm text-white/80">Preços</a>
              <a href="#faq" onClick={() => setMenuOpen(false)} className="text-sm text-white/80">FAQ</a>
              <Link to="/register" className="rounded-lg px-4 py-2 text-center text-sm font-semibold text-black" style={{ background: BRAND }}>
                Começar Agora
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section
        id="top"
        className="relative overflow-hidden px-6 pt-20 pb-24"
        style={{
          background: `radial-gradient(1200px 600px at 50% -100px, rgba(248,218,85,0.18), transparent 60%), linear-gradient(180deg, ${BG} 0%, ${BG_2} 100%)`,
        }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
            style={{ borderColor: "rgba(248,218,85,0.3)", color: BRAND, background: "rgba(248,218,85,0.08)" }}
          >
            <Star className="h-3 w-3" /> Novo: integração com 99Food disponível
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Gestão de Pedidos <span style={{ color: BRAND }}>Inteligente</span><br className="hidden sm:block" />
            para seu Restaurante
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
            Automatize pedidos do iFood e 99Food em um só lugar. Aumente vendas, reduza erros e ganhe tempo.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="rounded-xl px-7 py-3.5 text-base font-bold text-black shadow-lg transition hover:scale-[1.02] hover:brightness-110"
              style={{ background: BRAND, boxShadow: `0 10px 30px -10px ${BRAND}` }}
            >
              7 dias Grátis
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/50">Sem cartão de crédito necessário</p>

          {/* VSL — YouTube embed com detecção automática de aspect ratio */}
          <VideoEmbed />
        </div>
      </section>

      {/* STATS */}
      <section className="px-6 py-12" style={{ background: BG_2 }}>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
          {[
            { v: "500+", l: "Restaurantes ativos" },
            { v: "50K+", l: "Pedidos por mês" },
            { v: "99.9%", l: "Uptime garantido" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-4xl font-extrabold" style={{ color: BRAND }}>{s.v}</div>
              <div className="mt-1 text-sm text-white/60">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Tudo que você precisa em um só lugar</h2>
            <p className="mt-3 text-white/60">Ferramentas profissionais para escalar seu delivery.</p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:border-[rgba(248,218,85,0.4)]"
                style={{ background: BG_2, borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl transition group-hover:scale-110"
                  style={{ background: "rgba(248,218,85,0.12)", color: BRAND }}
                >
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-white/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 py-24" style={{ background: BG_2 }}>
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Preços simples e transparentes</h2>
            <p className="mt-3 text-white/60">Comece grátis. Cresça quando precisar.</p>
          </div>
          {plansLoading ? (
            <p className="mt-10 text-center text-sm text-white/50">Carregando planos…</p>
          ) : plans.length === 0 ? (
            <p className="mt-10 text-center text-sm text-white/50">Nenhum plano disponível no momento.</p>
          ) : (
            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => {
                const highlight = p.popular;
                return (
                  <div
                    key={p.id}
                    className="relative flex flex-col rounded-2xl border p-8 transition hover:-translate-y-1"
                    style={{
                      background: BG,
                      borderColor: highlight ? BRAND : "rgba(255,255,255,0.08)",
                      boxShadow: highlight ? `0 20px 60px -20px ${BRAND}` : undefined,
                    }}
                  >
                    {highlight && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider text-black"
                        style={{ background: BRAND }}
                      >
                        MAIS POPULAR
                      </span>
                    )}
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold">{formatPlanPrice(p)}</span>
                    </div>
                    <ul className="mt-6 flex-1 space-y-3">
                      {(p.features ?? []).map((feat) => (
                        <li key={feat} className="flex items-start gap-2 text-sm text-white/80">
                          <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: BRAND }} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/register"
                      className="mt-8 block rounded-xl px-5 py-3 text-center text-sm font-bold transition hover:brightness-110"
                      style={
                        highlight
                          ? { background: BRAND, color: "#000" }
                          : { border: "1px solid rgba(255,255,255,0.18)", color: "#fff" }
                      }
                    >
                      {p.is_free ? "Começar Grátis" : "Assinar"}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Restaurantes que confiam na Zero Tempo</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border p-8"
                style={{ background: BG_2, borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div className="flex gap-1" style={{ color: "#FACC15" }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-4 text-lg leading-relaxed text-white/85">"{t.quote}"</p>
                <div className="mt-6">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-white/50">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-24" style={{ background: BG_2 }}>
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Perguntas frequentes</h2>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={f.q}
                  className="overflow-hidden rounded-xl border"
                  style={{ background: BG, borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="font-semibold">{f.q}</span>
                    <ChevronDown
                      className="h-5 w-5 shrink-0 transition-transform"
                      style={{ transform: open ? "rotate(180deg)" : "none", color: BRAND }}
                    />
                  </button>
                  <div
                    className="grid transition-all duration-300"
                    style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm text-white/70">{f.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 py-24">
        <div
          className="mx-auto max-w-4xl rounded-3xl border p-12 text-center"
          style={{
            background: `radial-gradient(600px 300px at 50% 0%, rgba(248,218,85,0.2), transparent 70%), ${BG_2}`,
            borderColor: "rgba(248,218,85,0.25)",
          }}
        >
          <h2 className="text-3xl font-extrabold sm:text-4xl">Pronto para aumentar suas vendas?</h2>
          <p className="mt-4 text-white/70">Junte-se a 500+ restaurantes que estão crescendo com a Zero Tempo.</p>
          <Link
            to="/register"
            className="mt-8 inline-block rounded-xl px-8 py-4 text-base font-bold text-black shadow-lg transition hover:scale-[1.02] hover:brightness-110"
            style={{ background: BRAND, boxShadow: `0 12px 40px -10px ${BRAND}` }}
          >
            Comece seu Teste Grátis Agora
          </Link>
          <p className="mt-4 text-sm text-white/50">7 dias grátis • Sem cartão • Cancele quando quiser</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t px-6 py-12" style={{ borderColor: "rgba(255,255,255,0.06)", background: BG }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="text-lg font-extrabold" style={{ color: BRAND }}>Zero Tempo</div>
            <p className="mt-3 text-sm text-white/60">Gestão de pedidos inteligente para restaurantes modernos.</p>
          </div>
          <div>
            <h4 className="text-sm font-bold">Produto</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li><a href="#features" className="hover:text-white">Características</a></li>
              <li><a href="#pricing" className="hover:text-white">Preços</a></li>
              <li><a href="#faq" className="hover:text-white">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li><Link to="/politica-de-privacidade" className="hover:text-white">Política de Privacidade</Link></li>
              <li><Link to="/termos-de-uso" className="hover:text-white">Termos de Uso</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold">Contato</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>contato@zerotempo.com</li>
              <li>(62) 99261-5216</li>
              <li>Goiânia - GO / BR</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t pt-6 text-center text-xs text-white/40" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          © {new Date().getFullYear()} Zero Tempo. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

function VideoEmbed() {
  const aspect = useYouTubeAspect(YT_VIDEO_ID);
  const isVertical = aspect === "9 / 16";
  const wrapperMax = isVertical ? "max-w-[360px] sm:max-w-[400px]" : "max-w-3xl";
  return (
    <div className={`mx-auto mt-10 w-full sm:mt-12 ${wrapperMax}`}>
      <div
        className="relative w-full overflow-hidden rounded-xl border shadow-2xl sm:rounded-2xl"
        style={{
          aspectRatio: aspect,
          borderColor: "rgba(248,218,85,0.25)",
          boxShadow: `0 30px 80px -30px ${BRAND}`,
        }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${YT_VIDEO_ID}`}
          title="Zero Tempo — Veja como funciona"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, display: "block" }}
        />
      </div>
      <p className="mt-3 text-xs text-white/40">Assista em 2 minutos como a Zero Tempo transforma sua operação</p>
    </div>
  );
}
