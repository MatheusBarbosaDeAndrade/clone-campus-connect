import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AppShell from "components/AppShell.js";
import { ChevronRightIcon, SearchIcon } from "components/icons.js";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
} from "components/ui.js";
import { formatDayAndTime } from "lib/format.js";
import { withSession } from "lib/ssr.js";
import { STATUSES, STATUS_LABELS, ticketCode } from "lib/ticket-labels.js";
import ticket from "models/ticket.js";

const SORTS = {
  recent: "Mais Recentes",
  oldest: "Mais Antigos",
  priority: "Maior Prioridade",
};

export default function MyTickets({
  viewer,
  unreadCount,
  now,
  tickets,
  filters,
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);

  function applyFilters(next) {
    const query = { ...filters, search, ...next };
    Object.keys(query).forEach((key) => {
      if (!query[key] || (key === "sort" && query[key] === "recent"))
        delete query[key];
    });
    router.replace({ pathname: "/chamados", query }, undefined, {
      scroll: false,
    });
  }

  // Busca com pequeno atraso enquanto o usuário digita.
  useEffect(() => {
    if (search === filters.search) return undefined;
    const timer = setTimeout(() => applyFilters({ search }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters = Boolean(filters.search || filters.status);

  return (
    <AppShell title="Meus Chamados" viewer={viewer} unreadCount={unreadCount}>
      <PageHeader
        title="Meus Chamados"
        subtitle="Gerencie e acompanhe todos os seus chamados de suporte"
      />

      <div className="mb-4 flex flex-col gap-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar chamados por assunto, descrição ou número..."
            aria-label="Buscar chamados"
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-12 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300 focus:outline-none"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <select
            aria-label="Filtrar por status"
            value={filters.status}
            onChange={(event) => applyFilters({ status: event.target.value })}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold focus:ring-2 focus:ring-slate-300 focus:outline-none"
          >
            <option value="">Todos os Status</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenar"
            value={filters.sort || "recent"}
            onChange={(event) => applyFilters({ sort: event.target.value })}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold focus:ring-2 focus:ring-slate-300 focus:outline-none"
          >
            {Object.entries(SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters
                ? "Nenhum chamado encontrado"
                : "Você ainda não tem chamados"
            }
            description={
              hasFilters
                ? "Tente outros termos de busca ou remova os filtros."
                : "Abra um chamado para solicitar suporte da equipe."
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setSearch("");
                    router.replace("/chamados");
                  }}
                >
                  Limpar filtros
                </Button>
              ) : (
                <Button href="/chamados/novo" size="md">
                  Abrir novo chamado
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="hidden grid-cols-[120px_1fr_150px_150px_32px] gap-4 border-b border-slate-200 px-5 pb-3 text-sm font-semibold text-slate-600 md:grid">
            <span>ID &amp; Setor</span>
            <span>Assunto / Descrição</span>
            <span>Atualização</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {tickets.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/chamados/${item.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 hover:shadow-sm md:grid-cols-[120px_1fr_150px_150px_32px]"
                >
                  <div className="col-span-2 md:col-span-1">
                    <div className="text-sm font-bold text-slate-900">
                      {ticketCode(item.id)}
                    </div>
                    <div className="text-xs font-medium text-slate-600">
                      {item.category_name}
                    </div>
                  </div>
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <div className="truncate text-[15px] font-bold text-slate-900">
                      {item.title}
                    </div>
                    <div className="truncate text-sm text-slate-600">
                      {item.description}
                    </div>
                  </div>
                  <div className="text-sm text-slate-400">
                    {formatDayAndTime(item.updated_at, now)}
                  </div>
                  <div>
                    <StatusBadge status={item.status} uppercase />
                  </div>
                  <ChevronRightIcon className="hidden h-6 w-6 text-slate-400 md:block" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async (context, viewer) => {
    const { search = "", status = "", sort = "recent" } = context.query;
    const filters = {
      search: typeof search === "string" ? search : "",
      status: STATUSES.includes(status) ? status : "",
      sort: typeof sort === "string" ? sort : "recent",
    };
    return {
      filters,
      tickets: await ticket.listForRequester(viewer.id, filters),
    };
  },
  { roles: ["user"] },
);
