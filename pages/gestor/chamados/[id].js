import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AppShell from "components/AppShell.js";
import AttachmentsCard from "components/AttachmentsCard.js";
import { ChevronLeftIcon, TrendingUpIcon } from "components/icons.js";
import MessagePanel from "components/MessagePanel.js";
import TicketTimeline from "components/TicketTimeline.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  MetaItem,
  SectionTitle,
  SelectField,
  StatusBadge,
  cx,
} from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { formatDateTime, slaRemaining } from "lib/format.js";
import { withSession } from "lib/ssr.js";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUSES,
  STATUS_LABELS,
  ticketCode,
} from "lib/ticket-labels.js";
import ticketModel from "models/ticket.js";
import user from "models/user.js";

const PRIORITY_TEXT = {
  critica: "text-red-700",
  alta: "text-amber-700",
  media: "text-blue-700",
  baixa: "text-slate-700",
};

export default function StaffTicketDetail({
  viewer,
  unreadCount,
  now,
  details,
  staff,
}) {
  const router = useRouter();
  const { ticket, events, messages, attachments } = details;
  const publicMessages = messages.filter((m) => !m.is_internal);
  const internalNotes = messages.filter((m) => m.is_internal);
  const [form, setForm] = useState({
    assigneeId: ticket.assignee_id || "",
    priority: ticket.priority,
    status: ticket.status,
  });
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(null);
  const closed = ticket.status === "fechado";
  const remaining = slaRemaining(ticket.sla_due_at, now);
  const changed =
    form.assigneeId !== (ticket.assignee_id || "") ||
    form.priority !== ticket.priority ||
    form.status !== ticket.status;

  async function refresh() {
    await router.replace(`/gestor/chamados/${ticket.id}`, undefined, {
      scroll: false,
    });
  }

  async function save(event) {
    event.preventDefault();
    const payload = {};
    if (form.assigneeId !== (ticket.assignee_id || ""))
      payload.assigneeId = form.assigneeId || null;
    if (form.priority !== ticket.priority) payload.priority = form.priority;
    if (form.status !== ticket.status) payload.status = form.status;
    setBusy("save");
    setFeedback(null);
    try {
      await apiRequest("PATCH", `/api/v1/tickets/${ticket.id}`, payload);
      await refresh();
      setFeedback({ variant: "success", text: "Chamado atualizado." });
    } catch (requestError) {
      setFeedback({ variant: "error", text: requestError.message });
    } finally {
      setBusy(null);
    }
  }

  async function quick(payload, key) {
    setBusy(key);
    setFeedback(null);
    try {
      if (key === "escalate") {
        await apiRequest("POST", `/api/v1/tickets/${ticket.id}/escalate`);
      } else {
        await apiRequest("PATCH", `/api/v1/tickets/${ticket.id}`, payload);
      }
      await refresh();
      setFeedback({
        variant: "success",
        text:
          key === "escalate"
            ? "Chamado escalado e gestores notificados."
            : "Chamado atualizado.",
      });
    } catch (requestError) {
      setFeedback({ variant: "error", text: requestError.message });
    } finally {
      setBusy(null);
    }
  }

  // Mantém o formulário em sincronia quando os dados mudam no servidor.
  const [syncedAt, setSyncedAt] = useState(ticket.updated_at);
  if (syncedAt !== ticket.updated_at) {
    setSyncedAt(ticket.updated_at);
    setForm({
      assigneeId: ticket.assignee_id || "",
      priority: ticket.priority,
      status: ticket.status,
    });
  }

  return (
    <AppShell
      title={`Chamado ${ticketCode(ticket.id)}`}
      viewer={viewer}
      unreadCount={unreadCount}
    >
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/gestor/fila"
            className="flex items-center gap-1 text-sm font-bold text-slate-700 uppercase hover:text-slate-900"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Voltar para fila
          </Link>
          <span className="hidden h-6 w-px bg-slate-300 sm:block" />
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Painel do Chamado {ticketCode(ticket.id)}
          </h1>
        </div>
        <Badge
          className={cx(
            "px-3 py-1.5 text-xs",
            ticket.priority === "critica"
              ? "bg-red-100 text-red-700"
              : "bg-slate-100 text-slate-700",
          )}
        >
          Urgência {PRIORITY_LABELS[ticket.priority]}
        </Badge>
      </div>

      {feedback && (
        <Alert variant={feedback.variant} className="mb-6">
          {feedback.text}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_480px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <StatusBadge status={ticket.status} uppercase />
              <span
                className={cx(
                  "text-sm font-medium",
                  closed
                    ? "text-slate-500"
                    : remaining.seconds < 3600
                      ? "text-red-500"
                      : "text-slate-600",
                )}
              >
                {closed
                  ? `Fechado em ${formatDateTime(ticket.closed_at)}`
                  : remaining.overdue
                    ? `SLA ${remaining.label.toLowerCase()}`
                    : `SLA: ${remaining.label} restantes`}
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              {ticket.title}
            </h2>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
              <MetaItem label="Categoria">{ticket.category_name}</MetaItem>
              <MetaItem
                label="Prioridade"
                valueClassName={PRIORITY_TEXT[ticket.priority]}
              >
                {PRIORITY_LABELS[ticket.priority]}
              </MetaItem>
              <MetaItem label="Solicitante">
                {ticket.requester_name}
                {ticket.requester_role !== "user" &&
                  ` (${ROLE_LABELS[ticket.requester_role]})`}
              </MetaItem>
              <MetaItem label="Responsável">
                {ticket.assignee_name || "Não atribuído"}
              </MetaItem>
              <MetaItem label="Criado em">
                {formatDateTime(ticket.created_at)}
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
            canUpload
            onUploaded={refresh}
          />

          <TicketTimeline
            events={events}
            now={now}
            title="Linha do Tempo (Andamento)"
            showRole
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-6">
            <SectionTitle className="mb-4 text-base">
              Ações do Gestor
            </SectionTitle>
            <form onSubmit={save} className="flex flex-col gap-4">
              <SelectField
                label="Responsável"
                value={form.assigneeId}
                onChange={(event) =>
                  setForm((f) => ({ ...f, assigneeId: event.target.value }))
                }
              >
                <option value="">Não atribuído</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({ROLE_LABELS[member.role]})
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Prioridade"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, priority: event.target.value }))
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, status: event.target.value }))
                  }
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Button
                type="submit"
                size="md"
                disabled={!changed}
                loading={busy === "save"}
              >
                Salvar alterações
              </Button>
            </form>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                size="md"
                disabled={
                  ticket.assignee_id === viewer.id || closed || busy !== null
                }
                loading={busy === "assume"}
                onClick={() => quick({ assigneeId: viewer.id }, "assume")}
              >
                Assumir chamado
              </Button>
              <Button
                variant="outline"
                size="md"
                disabled={closed || busy !== null}
                loading={busy === "escalate"}
                onClick={() => quick(null, "escalate")}
              >
                <TrendingUpIcon className="h-4 w-4" />
                Escalar / Elevar
              </Button>
            </div>
          </Card>

          <MessagePanel
            ticketId={ticket.id}
            messages={internalNotes}
            now={now}
            onSent={refresh}
            internal
          />

          <MessagePanel
            ticketId={ticket.id}
            messages={publicMessages}
            now={now}
            onSent={refresh}
            title="Mensagens com o solicitante"
            placeholder="Responder ao solicitante..."
            disabledReason={
              closed
                ? "Chamado fechado. Altere o status para reabrir e responder."
                : null
            }
          />
        </div>
      </div>
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async (context, viewer) => ({
    details: await ticketModel.findForViewer(context.params.id, viewer),
    staff: await user.listStaff(),
  }),
  { roles: ["agent", "manager"], loginPath: "/gestor/login" },
);
