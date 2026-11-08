import Link from "next/link";
import AppShell from "components/AppShell.js";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  LoaderIcon,
} from "components/icons.js";
import { IconBubble } from "components/StaffTicketTable.js";
import { actorLabel, describeEvent } from "components/TicketTimeline.js";
import {
  Card,
  PRIORITY_DOT,
  PageHeader,
  SectionTitle,
  StatCard,
  cx,
} from "components/ui.js";
import { formatRelative } from "lib/format.js";
import { withSession } from "lib/ssr.js";
import { PRIORITIES, PRIORITY_LABELS, ticketCode } from "lib/ticket-labels.js";
import metrics from "models/metrics.js";
import ticket from "models/ticket.js";

export default function StaffHome({
  viewer,
  unreadCount,
  now,
  counts,
  sla,
  byCategory,
  byPriority,
  activity,
}) {
  const maxCategory = Math.max(1, ...byCategory.map((c) => c.total));
  const totalOpen = PRIORITIES.reduce(
    (sum, p) => sum + (byPriority[p] || 0),
    0,
  );
  return (
    <AppShell title="Painel Geral" viewer={viewer} unreadCount={unreadCount}>
      <PageHeader
        title={`Olá, ${viewer.name.split(" ")[0]}!`}
        subtitle="Visão geral do atendimento • indicadores calculados em tempo real"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Não Atribuídos"
          value={counts.unassigned}
          icon={<IconBubble icon={AlertCircleIcon} tone="amber" />}
        />
        <StatCard
          label="Em Andamento"
          value={counts.in_progress}
          icon={<IconBubble icon={LoaderIcon} tone="blue" />}
        />
        <StatCard
          label="Vencendo SLA"
          value={counts.sla_risk}
          icon={<IconBubble icon={AlertTriangleIcon} tone="red" />}
        />
        <StatCard
          label="Resolvidos Hoje"
          value={counts.resolved_today}
          icon={<IconBubble icon={CheckCircleIcon} tone="green" />}
        />
        <StatCard
          label="Cumprimento SLA"
          value={
            sla.compliance_percent === null ? "—" : `${sla.compliance_percent}%`
          }
          icon={<IconBubble icon={ClockIcon} tone="green" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <SectionTitle>Chamados abertos por setor</SectionTitle>
            <Link
              href="/gestor/fila"
              className="text-sm font-semibold text-slate-700 hover:underline"
            >
              Ver fila
            </Link>
          </div>
          <ul className="flex flex-col gap-4">
            {byCategory.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/gestor/fila?categoryId=${item.id}`}
                  className="block"
                >
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {item.name}
                    </span>
                    <span className="font-bold text-slate-900">
                      {item.total}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full bg-blue-500"
                      style={{ width: `${(item.total / maxCategory) * 100}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <SectionTitle className="mt-8 mb-4">
            Abertos por prioridade
          </SectionTitle>
          {totalOpen === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhum chamado aberto no momento.
            </p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full">
                {PRIORITIES.slice()
                  .reverse()
                  .map((p) =>
                    byPriority[p] ? (
                      <div
                        key={p}
                        className={PRIORITY_DOT[p]}
                        style={{
                          width: `${(byPriority[p] / totalOpen) * 100}%`,
                        }}
                      />
                    ) : null,
                  )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {PRIORITIES.slice()
                  .reverse()
                  .map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-2 text-slate-600"
                    >
                      <span
                        className={cx(
                          "h-2.5 w-2.5 rounded-full",
                          PRIORITY_DOT[p],
                        )}
                      />
                      {PRIORITY_LABELS[p]}:{" "}
                      <strong className="text-slate-900">
                        {byPriority[p] || 0}
                      </strong>
                    </span>
                  ))}
              </div>
            </>
          )}
        </Card>

        <Card className="p-6">
          <SectionTitle className="mb-5">Atividade recente</SectionTitle>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {activity.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/gestor/chamados/${event.ticket_id}`}
                    className="flex items-start justify-between gap-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {ticketCode(event.ticket_id)} · {event.ticket_title}
                      </p>
                      <p className="text-sm text-slate-600">
                        {describeEvent(event).text} — por {actorLabel(event)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatRelative(event.created_at, now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async () => {
    const [counts, sla, byCategory, byPriority, activity] = await Promise.all([
      ticket.queueCounts(),
      metrics.slaOverview(),
      metrics.openByCategory(),
      metrics.openByPriority(),
      metrics.recentActivity({ limit: 10 }),
    ]);
    return { counts, sla, byCategory, byPriority, activity };
  },
  { roles: ["agent", "manager"], loginPath: "/gestor/login" },
);
