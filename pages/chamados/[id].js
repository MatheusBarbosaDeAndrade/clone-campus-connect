import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AppShell from "components/AppShell.js";
import AttachmentsCard from "components/AttachmentsCard.js";
import { ChevronLeftIcon } from "components/icons.js";
import MessagePanel from "components/MessagePanel.js";
import TicketTimeline from "components/TicketTimeline.js";
import {
  Alert,
  Button,
  Card,
  MetaItem,
  SectionTitle,
  StatusBadge,
} from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { formatDayAndTime, formatRelative } from "lib/format.js";
import { withSession } from "lib/ssr.js";
import { PRIORITY_LABELS, ticketCode } from "lib/ticket-labels.js";
import ticketModel from "models/ticket.js";

export default function TicketDetail({ viewer, unreadCount, now, details }) {
  const router = useRouter();
  const { ticket, events, messages, attachments } = details;
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const closed = ticket.status === "fechado";

  async function refresh() {
    await router.replace(`/chamados/${ticket.id}`, undefined, {
      scroll: false,
    });
  }

  async function changeStatus(status) {
    if (
      status === "fechado" &&
      !window.confirm("Deseja realmente fechar este chamado?")
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("PATCH", `/api/v1/tickets/${ticket.id}`, { status });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title={`Chamado ${ticketCode(ticket.id)}`}
      viewer={viewer}
      unreadCount={unreadCount}
    >
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link
          href="/chamados"
          className="flex items-center gap-1 text-sm font-bold text-slate-700 uppercase hover:text-slate-900"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Voltar para lista
        </Link>
        <span className="hidden h-6 w-px bg-slate-300 sm:block" />
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Chamado {ticketCode(ticket.id)}
        </h1>
      </div>

      {router.query.criado && (
        <Alert variant="success" className="mb-6">
          Chamado aberto com sucesso! Acompanhe o andamento por aqui.
          {router.query.falhas &&
            ` Porém, ${router.query.falhas} anexo(s) não puderam ser enviados — tente anexá-los novamente abaixo.`}
        </Alert>
      )}
      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_480px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <StatusBadge status={ticket.status} uppercase />
              <span className="text-xs text-slate-600">
                Atualizado: {formatRelative(ticket.updated_at, now)}
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              {ticket.title}
            </h2>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
              <MetaItem label="Categoria">{ticket.category_name}</MetaItem>
              <MetaItem label="Prioridade">
                {PRIORITY_LABELS[ticket.priority]}
              </MetaItem>
              <MetaItem label="Data abertura">
                {formatDayAndTime(ticket.created_at, now)}
              </MetaItem>
              <MetaItem label="Responsável">
                {ticket.assignee_name || "Aguardando atribuição"}
              </MetaItem>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle className="mb-3 text-base">
              Descrição do Problema
            </SectionTitle>
            <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-slate-600">
              {ticket.description}
            </p>
          </Card>

          <AttachmentsCard
            ticketId={ticket.id}
            attachments={attachments}
            canUpload={!closed}
            onUploaded={refresh}
          />

          <TicketTimeline events={events} now={now} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <MessagePanel
            ticketId={ticket.id}
            messages={messages}
            now={now}
            onSent={refresh}
            className="min-h-[420px] flex-1"
            disabledReason={
              closed
                ? "Este chamado está fechado. Reabra-o para enviar novas mensagens."
                : null
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="danger"
              disabled={closed || busy}
              onClick={() => changeStatus("fechado")}
            >
              Fechar chamado
            </Button>
            <Button
              variant="outline"
              disabled={!closed || busy}
              onClick={() => changeStatus("reaberto")}
              caps
            >
              Reabrir
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async (context, viewer) => ({
    details: await ticketModel.findForViewer(context.params.id, viewer),
  }),
  { roles: ["user"] },
);
