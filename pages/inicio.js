import Link from "next/link";
import AppShell from "components/AppShell.js";
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  StatCard,
  StatusBadge,
} from "components/ui.js";
import { formatRelative } from "lib/format.js";
import { withSession } from "lib/ssr.js";
import ticket from "models/ticket.js";

export default function Dashboard({
  viewer,
  unreadCount,
  now,
  counts,
  recent,
}) {
  const firstName = viewer.name.split(" ")[0];
  return (
    <AppShell title="Início" viewer={viewer} unreadCount={unreadCount}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Olá, {firstName}!
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {viewer.email} • Portal de Suporte CampusConnect
          </p>
        </div>
        <Button href="/chamados/novo" size="md">
          Abrir novo chamado
        </Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Abertos"
          value={counts.open}
          dotClassName="bg-amber-700"
        />
        <StatCard
          label="Em Atendimento"
          value={counts.in_progress}
          dotClassName="bg-blue-700"
        />
        <StatCard
          label="Fechados"
          value={counts.closed}
          dotClassName="bg-red-700"
        />
      </div>

      <Card className="p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Chamados Recentes</SectionTitle>
          {recent.length > 0 && (
            <Link
              href="/chamados"
              className="text-sm font-semibold text-slate-700 hover:underline"
            >
              Ver todos
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="Você ainda não abriu nenhum chamado"
            description="Quando precisar de ajuda, abra um chamado e acompanhe o atendimento por aqui."
            action={
              <Button href="/chamados/novo" size="md">
                Abrir primeiro chamado
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="w-40 pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Descrição</th>
                  <th className="w-44 pb-3 font-semibold">Atualização</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id} className="group">
                    <td className="py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/chamados/${item.id}`}
                        className="font-bold text-slate-900 group-hover:underline"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="py-3 text-slate-400">
                      {formatRelative(item.updated_at, now)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async (context, viewer) => ({
    counts: await ticket.countsForRequester(viewer.id),
    recent: await ticket.listForRequester(viewer.id, { limit: 5 }),
  }),
  { roles: ["user"] },
);
