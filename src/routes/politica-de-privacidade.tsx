import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";

const BRAND = "#F8DA55";
const BG = "#0F1117";
const BG_2 = "#1a1d27";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Zero Tempo" },
      {
        name: "description",
        content:
          "Política de Privacidade da Zero Tempo. Saiba como tratamos seus dados pessoais e os dados dos pedidos de delivery.",
      },
      { property: "og:title", content: "Política de Privacidade — Zero Tempo" },
      {
        property: "og:description",
        content:
          "Política de Privacidade da Zero Tempo. Saiba como tratamos seus dados pessoais e os dados dos pedidos de delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
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
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold sm:text-4xl">Política de Privacidade</h1>
              <p className="mt-1 text-sm text-white/50">Zero Tempo — Política de Privacidade</p>
            </div>
          </div>

          <p className="mb-8 text-sm text-white/50">Última atualização: 23/07/2026</p>

          <div className="space-y-10">
            <Section number="1" title="Quem somos">
              <p>
                Esta Política de Privacidade descreve como a ZERO TEMPO LTDA, inscrita no CNPJ nº 42.467.564/0001-89
                ("Zero Tempo", "nós"), trata os dados pessoais no uso da plataforma disponível em{" "}
                <a
                  href="https://www.zerotempodepreparo.com/"
                  className="underline"
                  style={{ color: BRAND }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://www.zerotempodepreparo.com/
                </a>{" "}
                ("Plataforma"). Contato do encarregado de dados:{" "}
                <a href="mailto:contato@belfiusolucoes.com.br" className="underline" style={{ color: BRAND }}>
                  contato@belfiusolucoes.com.br
                </a>
                .
              </p>
            </Section>

            <Section number="2" title="O que é a Zero Tempo">
              <p>
                A Zero Tempo é uma plataforma de automação de pedidos para restaurantes, que se integra a plataformas de
                delivery (como iFood e 99Food) para automatizar a aceitação, o preparo, o despacho e o gerenciamento de
                pedidos.
              </p>
            </Section>

            <Section number="3" title="Dados que coletamos">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Dados de cadastro do lojista:</strong> nome, e-mail, telefone, empresa e dados de acesso.
                </li>
                <li>
                  <strong>Dados de integração:</strong> tokens de autorização e identificadores das lojas conectadas nas
                  plataformas de delivery.
                </li>
                <li>
                  <strong>Dados de pedidos:</strong> informações recebidas das plataformas de delivery para processar os
                  pedidos (itens, valores, status, endereço de entrega e dados de contato do cliente final fornecidos pela
                  plataforma de delivery).
                </li>
                <li>
                  <strong>Dados de uso:</strong> registros de acesso, logs e informações técnicas necessárias ao funcionamento
                  e à segurança.
                </li>
              </ul>
            </Section>

            <Section number="4" title="Para que usamos os dados">
              <ul className="list-disc space-y-2 pl-5">
                <li>Operar a automação de pedidos (aceitar, preparar, despachar, cancelar).</li>
                <li>Exibir pedidos, relatórios e indicadores ao lojista.</li>
                <li>Manter a segurança, prevenir fraudes e cumprir obrigações legais.</li>
                <li>Prestar suporte.</li>
              </ul>
            </Section>

            <Section number="5" title="Base legal (LGPD)">
              <p>
                Tratamos dados com base na execução de contrato com o lojista, no cumprimento de obrigação legal e no legítimo
                interesse para operação e segurança da Plataforma, conforme a Lei nº 13.709/2018 (LGPD).
              </p>
            </Section>

            <Section number="6" title="Compartilhamento">
              <p>
                Compartilhamos dados apenas com: (a) as plataformas de delivery integradas (iFood, 99Food) para executar as
                ações dos pedidos; (b) provedores de infraestrutura (hospedagem/servidores) estritamente para operar a
                Plataforma; e (c) autoridades, quando exigido por lei. Não vendemos dados pessoais.
              </p>
            </Section>

            <Section number="7" title="Armazenamento e segurança">
              <p>
                Os dados são armazenados em servidores com controles de acesso e medidas de segurança. Mantemos os dados pelo
                tempo necessário à prestação do serviço e ao cumprimento de obrigações legais.
              </p>
            </Section>

            <Section number="8" title="Direitos do titular">
              <p>
                O titular pode solicitar acesso, correção, exclusão, portabilidade ou informações sobre o tratamento, pelo
                e-mail{" "}
                <a href="mailto:contato@belfiusolucoes.com.br" className="underline" style={{ color: BRAND }}>
                  contato@belfiusolucoes.com.br
                </a>
                .
              </p>
            </Section>

            <Section number="9" title="Dados do consumidor final">
              <p>
                Os dados do cliente final que compra nas plataformas de delivery são fornecidos por essas plataformas e usados
                exclusivamente para processar e entregar o pedido, conforme as regras da respectiva plataforma.
              </p>
            </Section>

            <Section number="10" title="Alterações">
              <p>Podemos atualizar esta Política. A versão vigente estará sempre disponível nesta página.</p>
            </Section>

            <Section number="11" title="Contato">
              <p>
                Dúvidas:{" "}
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
