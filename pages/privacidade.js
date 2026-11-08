import Head from "next/head";
import Link from "next/link";
import { LogoBadge } from "components/AuthLayout.js";
import { Alert } from "components/ui.js";
import { PRIVACY_POLICY_VERSION } from "lib/privacy.js";

// Política de Privacidade (LGPD). O texto descreve o que o sistema realmente
// faz; os dados do controlador vêm de variáveis de ambiente porque dependem
// da instituição que opera o CampusConnect. Enquanto alguma delas não for
// definida, a página exibe um aviso de "modelo pendente de aprovação".

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}

function Pending({ children }) {
  return (
    <span className="rounded bg-amber-100 px-1 font-semibold text-amber-800">
      {children}
    </span>
  );
}

export default function PrivacyPolicy({
  controller,
  contactEmail,
  legalBasis,
}) {
  const isDraft = !controller || !contactEmail || !legalBasis;
  const version = new Date(
    `${PRIVACY_POLICY_VERSION}T12:00:00`,
  ).toLocaleDateString("pt-BR");

  return (
    <>
      <Head>
        <title>Política de Privacidade · CampusConnect</title>
      </Head>
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-8">
        <article className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm sm:p-12">
          <Link href="/" className="inline-flex items-center gap-3">
            <LogoBadge size="sm" />
            <span className="text-lg font-extrabold text-slate-900">
              CampusConnect
            </span>
          </Link>
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-slate-900">
            Política de Privacidade
          </h1>
          <p className="mt-2 text-sm text-slate-500">Versão de {version}</p>

          {isDraft && (
            <Alert variant="warning" className="mt-6">
              Texto modelo: a instituição ainda precisa revisar esta política e
              informar o controlador, o contato do encarregado e a base legal
              (variáveis PRIVACY_* da configuração).
            </Alert>
          )}

          <Section title="1. Quem trata os seus dados">
            <p>
              O CampusConnect é o portal de chamados de suporte acadêmico
              operado por{" "}
              {controller || <Pending>[nome da instituição]</Pending>}, que é a
              controladora dos dados pessoais tratados aqui, nos termos da Lei
              Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
            <p>
              Contato do encarregado pelo tratamento de dados pessoais (DPO):{" "}
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="font-bold text-slate-900 underline"
                >
                  {contactEmail}
                </a>
              ) : (
                <Pending>[email do encarregado]</Pending>
              )}
              .
            </p>
          </Section>

          <Section title="2. Quais dados coletamos">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Cadastro:</strong> nome, telefone, email e senha (a
                senha é guardada apenas de forma criptografada e irreversível,
                nunca em texto).
              </li>
              <li>
                <strong>Chamados:</strong> assunto, categoria, descrição,
                mensagens e arquivos anexados (PNG, JPG ou PDF) que você envia.
              </li>
              <li>
                <strong>Uso e segurança:</strong> data do último acesso, sessões
                de login e o registro do aceite desta política. Para impedir
                ataques de adivinhação de senha, guardamos por até 1 dia um
                código irreversível (hash) do login digitado e do endereço IP.
              </li>
            </ul>
            <p>
              Não peça nem envie nos chamados dados sensíveis (saúde, religião,
              biometria etc.) que não sejam indispensáveis para o atendimento.
            </p>
          </Section>

          <Section title="3. Para que usamos e com qual base legal">
            <p>
              Usamos os dados exclusivamente para registrar, encaminhar e
              responder às suas solicitações de suporte; enviar avisos sobre o
              andamento dos chamados e emails de recuperação de senha; medir a
              qualidade do atendimento (prazos de SLA e indicadores da equipe);
              e proteger a sua conta e o sistema contra acessos indevidos.
            </p>
            <p>
              Base legal:{" "}
              {legalBasis || (
                <Pending>[base legal definida pela instituição]</Pending>
              )}
              .
            </p>
          </Section>

          <Section title="4. Com quem compartilhamos">
            <p>
              Os chamados são visualizados apenas por você e pela equipe de
              atendimento da instituição (agentes e gestores). Notas internas da
              equipe não ficam visíveis para você. Usamos um provedor de
              hospedagem para manter o sistema e um serviço de email para enviar
              as mensagens; eles atuam somente sob as instruções da instituição.
              Não vendemos nem compartilhamos seus dados para publicidade.
            </p>
          </Section>

          <Section title="5. Cookies">
            <p>
              Usamos apenas um cookie essencial, que mantém você conectado. Ele
              dura até o navegador ser fechado (no máximo 12 horas) ou 30 dias
              se você marcar &quot;Lembrar-me&quot;. Não usamos cookies de
              publicidade nem de rastreamento.
            </p>
          </Section>

          <Section title="6. Por quanto tempo guardamos">
            <p>
              Os dados da conta e dos chamados ficam guardados enquanto a conta
              existir. Links de recuperação de senha expiram em 60 minutos;
              sessões expiram conforme o item anterior; registros de tentativas
              de acesso são apagados após 1 dia. Cópias de segurança (backup) do
              banco são mantidas por tempo limitado e substituídas
              automaticamente.
            </p>
            <p>
              Se você excluir a sua conta, seu nome, email e telefone são
              apagados de forma definitiva. Os chamados que você abriu continuam
              no histórico do atendimento como &quot;Usuário removido&quot;,
              porque fazem parte do registro do serviço prestado pela
              instituição.
            </p>
          </Section>

          <Section title="7. Seus direitos">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Acesso e portabilidade:</strong> em Meu Perfil, use
                &quot;Baixar meus dados&quot;.
              </li>
              <li>
                <strong>Correção:</strong> altere nome e telefone em Meu Perfil.
              </li>
              <li>
                <strong>Eliminação:</strong> em Meu Perfil, use &quot;Excluir
                minha conta&quot;.
              </li>
              <li>
                <strong>
                  Informações, revogação do consentimento ou reclamações:
                </strong>{" "}
                fale com o encarregado pelo contato acima. Você também pode
                procurar a Autoridade Nacional de Proteção de Dados (ANPD).
              </li>
            </ul>
          </Section>

          <Section title="8. Segurança">
            <p>
              O acesso é feito por conexão criptografada (HTTPS), as senhas são
              protegidas por hash, cada pessoa só acessa os próprios chamados e
              há limite de tentativas de login. Mesmo assim, nenhum sistema é
              totalmente imune a falhas; em caso de incidente que possa causar
              risco relevante, você e a ANPD serão comunicados.
            </p>
          </Section>

          <p className="mt-10 text-sm">
            <Link href="/" className="font-bold text-slate-900 hover:underline">
              ← Voltar ao CampusConnect
            </Link>
          </p>
        </article>
      </div>
    </>
  );
}

export function getServerSideProps() {
  return {
    props: {
      controller: process.env.PRIVACY_CONTROLLER_NAME || null,
      contactEmail: process.env.PRIVACY_CONTACT_EMAIL || null,
      legalBasis: process.env.PRIVACY_LEGAL_BASIS || null,
    },
  };
}
