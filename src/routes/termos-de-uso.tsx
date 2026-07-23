import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";

const BRAND = "#F8DA55";
const BG = "#0F1117";
const BG_2 = "#1a1d27";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Zero Tempo" },
      {
        name: "description",
        content:
          "Termos de Uso da Zero Tempo. Leia as regras e condições para utilização da plataforma de automação de pedidos.",
      },
      { property: "og:title", content: "Termos de Uso — Zero Tempo" },
      {
        property: "og:description",
        content:
          "Termos de Uso da Zero Tempo. Leia as regras e condições para utilização da plataforma de automação de pedidos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsOfUsePage,
});

function TermsOfUsePage() {
  return (
    <div style={{ background: BG, color: "#fff" }} className="min-h-screen">
      <header className="border-b px-6 py-4" style={{ borderColor: "rgba(255,255,255,0.06)", background: BG }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o site
          </Link>
          <span className="text-lg font-extrabold" style={{ color: BRAND }}>
            Zero Tempo
          </span>
        </div>
      </header>

      <main className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "rgba(248,218,85,0.12)", color: BRAND }}
            >
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold sm:text-4xl">Termos de Uso</h1>
              <p className="mt-1 text-sm text-white/50">Zero Tempo — Termos de Uso</p>
            </div>
          </div>

          <p className="mb-8 text-sm text-white/50">Última atualização: 23/07/2026</p>

          <div className="space-y-10">
            <Section number="1" title="Aceitação">
              <p>
                Ao usar a plataforma Zero Tempo, disponível em{" "}
                <a
                  href="https://www.zerotempodepreparo.com/"
                  className="underline"
                  style={{ color: BRAND }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://www.zerotempodepreparo.com/
                </a>
                , operada pela ZERO TEMPO LTDA, CNPJ 42.467.564/0001-89 ("Zero Tempo"), você ("Usuário") concorda com
                estes Termos.
              </p>
            </Section>

            <Section number="2" title="Descrição do serviço">
              <p>
                A Zero Tempo é uma plataforma que automatiza o gerenciamento de pedidos de restaurantes integrados a
                plataformas de delivery (iFood, 99Food e outras), incluindo aceitação, preparo, despacho, cancelamento e
                relatórios.
              </p>
            </Section>

            <Section number="3" title="Cadastro e conta">
              <p>
                O Usuário é responsável pela veracidade dos dados e pela guarda de suas credenciais. O uso é destinado a
                estabelecimentos e responsáveis autorizados.
              </p>
            </Section>

            <Section number="4" title="Integração com plataformas de delivery">
              <p>
                O Usuário autoriza a Zero Tempo a se conectar às suas lojas nas plataformas de delivery, por meio dos fluxos
                oficiais de autorização, para executar as ações de pedidos em seu nome. O Usuário é responsável por ter
                contas ativas e regulares nessas plataformas.
              </p>
            </Section>

            <Section number="5" title="Planos e pagamento">
              <p>
                O acesso pode ser gratuito (período de teste) ou por assinatura (semanal, mensal ou anual). Ao término do
                período de teste ou da vigência do plano sem renovação, o acesso pode ser suspenso até a regularização. Valores
                e condições são informados no momento da contratação.
              </p>
            </Section>

            <Section number="6" title="Responsabilidades do Usuário">
              <p>
                O Usuário se compromete a usar a Plataforma de forma lícita, a manter suas informações atualizadas e a não
                utilizar o serviço para fins fraudulentos ou que violem as regras das plataformas de delivery.
              </p>
            </Section>

            <Section number="7" title="Limitação de responsabilidade">
              <p>
                A Zero Tempo atua como ferramenta de automação e depende da disponibilidade e das regras das plataformas de
                delivery. Não nos responsabilizamos por indisponibilidades, alterações ou falhas dessas plataformas de
                terceiros, nem por prejuízos decorrentes de uso indevido pelo Usuário.
              </p>
            </Section>

            <Section number="8" title="Disponibilidade">
              <p>
                Empregamos esforços para manter a Plataforma disponível, mas o serviço pode sofrer interrupções para
                manutenção ou por fatores externos.
              </p>
            </Section>

            <Section number="9" title="Rescisão">
              <p>
                O Usuário pode encerrar o uso a qualquer momento. Podemos suspender ou encerrar contas que violem estes Termos
                ou a lei.
              </p>
            </Section>

            <Section number="10" title="Privacidade">
              <p>
                O tratamento de dados segue nossa{" "}
                <Link to="/politica-de-privacidade" className="underline" style={{ color: BRAND }}>
                  Política de Privacidade
                </Link>
                .
              </p>
            </Section>

            <Section number="11" title="Foro e legislação">
              <p>
                Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio da Zero Tempo LTDA para
                dirimir controvérsias.
              </p>
            </Section>

            <Section number="12" title="Contato">
              <p>
                <a href="mailto:contato@belfiusolucoes.com.br" className="underline" style={{ color: BRAND }}>
                  contato@belfiusolucoes.com.br
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </main>

      <footer className="border-t px-6 py-10" style={{ borderColor: "rgba(255,255,255,0.06)", background: BG_2 }}>
        <div className="mx-auto max-w-4xl text-center text-sm text-white/50">
          <div className="mb-4 flex items-center justify-center gap-6">
            <Link to="/termos-de-uso" className="hover:text-white">
              Termos de Uso
            </Link>
            <Link to="/politica-de-privacidade" className="hover:text-white">
              Política de Privacidade
            </Link>
          </div>
          <p>© {new Date().getFullYear()} Zero Tempo. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-6 sm:p-8" style={{ background: BG_2, borderColor: "rgba(255,255,255,0.06)" }}>
      <h2 className="mb-4 text-xl font-bold">
        <span style={{ color: BRAND }}>{number}.</span> {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}
