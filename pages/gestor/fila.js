import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AppShell from "components/AppShell.js";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  DownloadIcon,
  HelpCircleIcon,
  LoaderIcon,
  SearchIcon,
} from "components/icons.js";
import StaffTicketTable, { IconBubble } from "components/StaffTicketTable.js";
import { Badge, Card, EmptyState, StatCard, cx } from "components/ui.js";
import { withSession } from "lib/ssr.js";
import category from "models/category.js";
import { QUEUE_TABS } from "lib/ticket-labels.js";
import ticket from "models/ticket.js";

const TAB_LABELS = {
  all: "Todos",
  unassigned: "Não Atribuídos",
  critical: "Críticos",
  sla_risk: "Vencendo SLA",
};

export default function Queue({
  viewer,
  unreadCount,
  now,
  tickets,
  counts,
  categories,
  filters,
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);

  function applyFilters(next) {
    const query = { ...filters, search, ...next };
    Object.keys(query).forEach((key) => {
      if (!query[key] || (key === "tab" && query[key] === "all"))
        delete query[key];
    });
    router.replace({ pathname: "/gestor/fila", query }, undefined, {
      scroll: false,
    });
  }

  useEffect(() => {
    if (search === filters.search) return undefined;
    const timer = setTimeout(() => applyFilters({ search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();

  return (
    <AppShell
      title="Fila de Chamados"
      viewer={viewer}
      unreadCount={unreadCount}
    >
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Fila de Chamados
            </h1>
            <Badge className="bg-blue-100 text-blue-800">{viewer.name}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Painel Geral de Supervisão e Controle
          </p>
        </div>
        <div className="relative w-full xl:w-80">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar chamados..."
            aria-label="Buscar chamados"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-12 text-sm focus:ring-2 focus:ring-slate-300 focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          label="Aguardando Resposta"
          value={counts.waiting}
          icon={<IconBubble icon={HelpCircleIcon} tone="amber" />}
        />
        <StatCard
          label="Resolvidos Hoje"
          value={counts.resolved_today}
          icon={<IconBubble icon={CheckCircleIcon} tone="green" />}
        />
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filtros da fila"
        >
          {QUEUE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filters.tab === tab}
              onClick={() => applyFilters({ tab })}
              className={cx(
                "rounded-lg border bg-white px-4 py-2 text-sm transition",
                filters.tab === tab
                  ? "border-slate-900 font-bold text-slate-900"
                  : "border-slate-200 font-medium text-slate-700 hover:border-slate-300",
              )}
            >
              {TAB_LABELS[tab]} ({counts[tab]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrar setor"
            value={filters.categoryId}
            onChange={(event) =>
              applyFilters({ categoryId: event.target.value })
            }
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-slate-300 focus:outline-none"
          >
            <option value="">Todos os setores</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <a
            href={`/api/v1/tickets/export${exportQuery ? `?${exportQuery}` : ""}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:border-slate-300"
          >
            <DownloadIcon className="h-4 w-4" />
            Exportar Relatório
          </a>
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        {tickets.length === 0 ? (
          <EmptyState
            title="Nenhum chamado nesta visão"
            description="Ajuste os filtros ou a busca para ver outros chamados."
          />
        ) : (
          <StaffTicketTable tickets={tickets} now={now} />
        )}
      </Card>
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async (context) => {
    const { tab = "all", categoryId = "", search = "" } = context.query;
    const filters = {
      tab: QUEUE_TABS.includes(tab) ? tab : "all",
      categoryId: /^\d+$/.test(categoryId) ? categoryId : "",
      search: typeof search === "string" ? search : "",
    };
    const [tickets, counts, categories] = await Promise.all([
      ticket.listQueue(filters),
      ticket.queueCounts(),
      category.listActive(),
    ]);
    return { tickets, counts, categories, filters };
  },
  { roles: ["agent", "manager"], loginPath: "/gestor/login" },
);
