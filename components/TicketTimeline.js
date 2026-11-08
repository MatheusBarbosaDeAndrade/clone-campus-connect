import { Card, SectionTitle, cx } from "components/ui.js";
import { formatDayAndTime } from "lib/format.js";
import {
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
} from "lib/ticket-labels.js";

const DOTS = {
  green: "bg-emerald-100 [&>span]:bg-emerald-600",
  amber: "bg-amber-100 [&>span]:bg-amber-600",
  blue: "bg-blue-100 [&>span]:bg-blue-600",
  red: "bg-red-100 [&>span]:bg-red-600",
  slate: "bg-slate-100 [&>span]:bg-slate-500",
};

export function describeEvent(event) {
  switch (event.type) {
    case "created":
      return { text: "Aberto", tone: "green" };
    case "status_changed":
      return {
        text: STATUS_LABELS[event.to_value],
        tone:
          event.to_value === "aguardando"
            ? "amber"
            : event.to_value === "em_analise"
              ? "amber"
              : "blue",
      };
    case "closed":
      return { text: "Fechado", tone: "red" };
    case "reopened":
      return { text: "Reaberto (SLA reiniciado)", tone: "blue" };
    case "assigned":
      return { text: `Atribuído a ${event.to_value}`, tone: "slate" };
    case "unassigned":
      return { text: "Responsável removido", tone: "slate" };
    case "priority_changed":
      return {
        text: `Prioridade: ${PRIORITY_LABELS[event.from_value]} → ${PRIORITY_LABELS[event.to_value]}`,
        tone: "amber",
      };
    case "escalated":
      return {
        text:
          event.from_value === event.to_value
            ? "Chamado escalado"
            : `Escalado (${PRIORITY_LABELS[event.from_value]} → ${PRIORITY_LABELS[event.to_value]})`,
        tone: "red",
      };
    case "responded":
      return { text: "Respondido", tone: "blue" };
    case "note_added":
      return { text: "Nota Interna Adicionada", tone: "blue" };
    case "attachment_added":
      return { text: `Anexo adicionado: ${event.to_value}`, tone: "slate" };
    default:
      return { text: event.type, tone: "slate" };
  }
}

export function actorLabel(event, { showRole = false } = {}) {
  if (!event.actor_name) return "Atribuição Automática";
  if (showRole && event.actor_role && event.actor_role !== "user") {
    return `${event.actor_name} (${ROLE_LABELS[event.actor_role]})`;
  }
  return event.actor_name;
}

export default function TicketTimeline({
  events,
  now,
  title = "Andamento do Chamado",
  showRole,
}) {
  return (
    <Card className="p-6">
      <SectionTitle className="mb-4 text-base">{title}</SectionTitle>
      <ol className="flex flex-col gap-4">
        {events.map((event) => {
          const { text, tone } = describeEvent(event);
          return (
            <li key={event.id} className="flex items-start gap-3 text-sm">
              <span
                className={cx(
                  "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  DOTS[tone],
                )}
              >
                <span className="h-2 w-2 rounded-full" />
              </span>
              <p className="text-slate-600">
                <strong className="font-bold text-slate-900">{text}</strong> —{" "}
                {formatDayAndTime(event.created_at, now)} por{" "}
                {actorLabel(event, { showRole })}
              </p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
