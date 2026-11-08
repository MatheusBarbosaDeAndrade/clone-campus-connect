import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AppShell from "components/AppShell.js";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  SettingsIcon,
  TrendingUpIcon,
} from "components/icons.js";
import { IconBubble } from "components/StaffTicketTable.js";
import {
  Alert,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  StatCard,
  cx,
} from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { formatDayAndTime, formatDuration, slaRemaining } from "lib/format.js";
import { withSession } from "lib/ssr.js";
import { PRIORITY_LABELS, ticketCode } from "lib/ticket-labels.js";
import metrics from "models/metrics.js";
import ticket from "models/ticket.js";

function ComplianceRing({ percent }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const value = percent ?? 0;
  return (
    <svg
      viewBox="0 0 80 80"
      className="h-20 w-20 shrink-0"
      role="img"
      aria-label={`${value}%`}
    >
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        strokeWidth="7"
        className="stroke-blue-100"
      />
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        className="stroke-blue-500"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value / 100)}
        transform="rotate(-90 40 40)"
      />
      <text
        x="40"
        y="45"
        textAnchor="middle"
        className="fill-slate-900 text-[15px] font-bold"
      >
        {percent === null ? "—" : `${percent}%`}
      </text>
    </svg>
  );
}

const ESCALATION_STYLE = {
  escalated: { icon: AlertCircleIcon, tone: "red" },
  priority_changed: { icon: TrendingUpIcon, tone: "amber" },
  reopened: { icon: CheckCircleIcon, tone: "blue" },
};

function escalationText(event) {
  if (event.type === "reopened") {
    return {
      title: `Chamado ${ticketCode(event.ticket_id)} Reaberto`,
      detail: "SLA reiniciado",
    };
  }
  const change =
    event.from_value === event.to_value
      ? `Prioridade mantida em ${PRIORITY_LABELS[event.to_value]}`
      : `De ${PRIORITY_LABELS[event.from_value]} para ${PRIORITY_LABELS[event.to_value]}`;
  return {
    title:
      event.type === "escalated"
        ? `Chamado ${ticketCode(event.ticket_id)} Escalado`
        : `Chamado ${ticketCode(event.ticket_id)} Prioridade Alterada`,
    detail: `${change}${event.actor_name ? ` por ${event.actor_name}` : ""}`,
  };
}

export default function SlaMonitor({
  viewer,
  unreadCount,
  now,
  overview,
  atRisk,
  escalations,
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  async function escalate(id) {
    setBusyId(id);
    setFeedback(null);
    try {
      await apiRequest("POST", `/api/v1/tickets/${id}/escalate`);
      await router.replace(router.asPath, undefined, { scroll: false });
      setFeedback({
        variant: "success",
        text: `Chamado ${ticketCode(id)} escalado.`,
      });
    } catch (requestError) {
      setFeedback({ variant: "error", text: requestError.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      title="SLA & Escalações"
      viewer={viewer}
      unreadCount={unreadCount}
    >
      <PageHeader
        title="Monitoramento de SLA e Escalações"
        subtitle="Controle de acordos de nível de serviço e resoluções urgentes"
      />
      {feedback && (
        <Alert variant={feedback.variant} className="mb-6">
          {feedback.text}
        </Alert>
      )}

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-5 p-5">
          <ComplianceRing percent={overview.compliance_percent} />
          <div>
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Taxa de cumprimento SLA
            </div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {overview.compliance_percent === null
                ? "Sem chamados concluídos"
                : `${overview.on_time} no prazo • ${overview.violated} violados`}
            </div>
          </div>
        </Card>
        <StatCard
          label="Tempo Médio de Resolução"
          value={formatDuration(overview.avg_resolution_seconds)}
          icon={<IconBubble icon={ClockIcon} tone="green" />}
        />
        <StatCard
          label="Chamados em Risco Crítico"
          value={overview.at_risk}
          icon={<IconBubble icon={AlertTriangleIcon} tone="red" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <SectionTitle className="mb-4">
            Em Risco de Violação (SLA &lt; 1h)
          </SectionTitle>
          {atRisk.length === 0 ? (
            <EmptyState
              title="Nenhum chamado em risco"
              description="Todos os chamados abertos estão dentro do prazo."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {atRisk.map((item) => {
                const remaining = slaRemaining(item.sla_due_at, now);
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <Link
                      href={`/gestor/chamados/${item.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <span className="font-bold text-slate-900">
                        {ticketCode(item.id)}
                      </span>{" "}
                      <span className="font-medium text-slate-800">
                        {item.title}
                      </span>
                    </Link>
                    <span
                      className={cx(
                        "text-sm font-bold whitespace-nowrap",
                        remaining.overdue ? "text-red-600" : "text-amber-600",
                      )}
                    >
                      {remaining.overdue
                        ? remaining.label
                        : `${remaining.label} restantes`}
                    </span>
                    <span className="text-sm whitespace-nowrap text-slate-500">
                      Agente: {item.assignee_name || "Não atribuído"}
                    </span>
                    <button
                      type="button"
                      onClick={() => escalate(item.id)}
                      disabled={busyId !== null}
                      className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-bold text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      {busyId === item.id ? "Escalando..." : "Escalar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <SectionTitle className="mb-4">Escalações Recentes</SectionTitle>
          {escalations.length === 0 ? (
            <EmptyState title="Nenhuma escalação registrada" />
          ) : (
            <ul className="flex flex-col gap-5">
              {escalations.map((event) => {
                const style = ESCALATION_STYLE[event.type];
                const text = escalationText(event);
                return (
                  <li key={event.id}>
                    <Link
                      href={`/gestor/chamados/${event.ticket_id}`}
                      className="flex items-start gap-3 hover:opacity-80"
                    >
                      <span className="mt-0.5">
                        <IconBubble icon={style.icon} tone={style.tone} />
                      </span>
                      <span>
                        <span className="block font-bold text-slate-900">
                          {text.title}
                        </span>
                        <span className="block text-sm text-slate-600">
                          {event.ticket_title} — {text.detail}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {formatDayAndTime(event.created_at, now)}
                          {event.assignee_name &&
                            ` • Responsável: ${event.assignee_name}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {viewer.role === "manager" && (
        <Link
          href="/gestor/configuracoes#sla"
          className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-brand px-6 py-5 text-white hover:bg-brand-hover"
        >
          <span className="flex items-center gap-3 font-bold">
            <SettingsIcon className="h-5 w-5" />
            Configurar prazos de SLA e regras de atribuição automática
          </span>
          <span className="text-sm font-bold text-slate-300">
            EDITAR REGRAS ▶
          </span>
        </Link>
      )}
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async () => {
    const [overview, atRisk, escalations] = await Promise.all([
      metrics.slaOverview(),
      ticket.listQueue({ tab: "sla_risk", limit: 20 }),
      metrics.recentEscalations(),
    ]);
    return { overview, atRisk, escalations };
  },
  { roles: ["agent", "manager"], loginPath: "/gestor/login" },
);
