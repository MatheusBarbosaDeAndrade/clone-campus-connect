import { useRouter } from "next/router";
import { PriorityBadge, StatusBadge, cx } from "components/ui.js";
import { slaRemaining } from "lib/format.js";
import { SLA_RISK_THRESHOLD_MINUTES, ticketCode } from "lib/ticket-labels.js";

export function SlaCell({ ticket, now }) {
  if (ticket.status === "fechado") {
    const onTime = new Date(ticket.closed_at) <= new Date(ticket.sla_due_at);
    return (
      <span
        className={cx(
          "text-xs font-semibold",
          onTime ? "text-emerald-600" : "text-red-600",
        )}
      >
        {onTime ? "No prazo" : "Violado"}
      </span>
    );
  }
  const remaining = slaRemaining(ticket.sla_due_at, now);
  const risky = remaining.seconds < SLA_RISK_THRESHOLD_MINUTES * 60;
  return (
    <span
      className={cx(
        "font-bold whitespace-nowrap",
        risky ? "text-red-500" : "text-slate-900",
      )}
    >
      {remaining.label}
    </span>
  );
}

export default function StaffTicketTable({ tickets, now }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-700">
            <th className="w-20 px-4 pb-3 font-bold">ID</th>
            <th className="px-4 pb-3 font-bold">Assunto / Descrição</th>
            <th className="w-44 px-4 pb-3 font-bold">Solicitante</th>
            <th className="w-40 px-4 pb-3 font-bold">Atribuído a</th>
            <th className="w-28 px-4 pb-3 font-bold">Prioridade</th>
            <th className="w-36 px-4 pb-3 font-bold">Status</th>
            <th className="w-28 px-4 pb-3 text-right font-bold">SLA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tickets.map((item) => (
            <tr
              key={item.id}
              onClick={() => router.push(`/gestor/chamados/${item.id}`)}
              className="cursor-pointer transition-colors hover:bg-slate-50"
            >
              <td className="px-4 py-4 font-bold text-slate-900">
                {ticketCode(item.id)}
              </td>
              <td className="max-w-0 px-4 py-4">
                <a
                  href={`/gestor/chamados/${item.id}`}
                  onClick={(event) => event.preventDefault()}
                  className="block truncate text-[15px] font-bold text-slate-900"
                >
                  {item.title}
                </a>
                <div className="truncate text-xs text-slate-500">
                  {item.description}
                </div>
              </td>
              <td className="px-4 py-4 text-slate-700">
                {item.requester_name}
              </td>
              <td className="px-4 py-4">
                {item.assignee_name ? (
                  <span className="text-slate-700">{item.assignee_name}</span>
                ) : (
                  <span className="text-slate-500 italic">Não atribuído</span>
                )}
              </td>
              <td className="px-4 py-4">
                <PriorityBadge priority={item.priority} />
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-4 py-4 text-right">
                <SlaCell ticket={item} now={now} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function IconBubble({ icon: Icon, tone }) {
  const tones = {
    amber: "bg-amber-100 text-amber-600",
    blue: "bg-blue-100 text-blue-600",
    green: "bg-emerald-100 text-emerald-600",
    red: "bg-red-100 text-red-600",
  };
  return (
    <span
      className={cx(
        "inline-flex h-7 w-7 items-center justify-center rounded-full",
        tones[tone],
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
