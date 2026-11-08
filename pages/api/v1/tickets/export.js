import { createHandler, requireUser, STAFF_ROLES } from "infra/controller.js";
import ticket from "models/ticket.js";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  ticketCode,
} from "lib/ticket-labels.js";

function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Evita injeção de fórmulas ao abrir o CSV em planilhas.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: process.env.APP_TIMEZONE || "America/Sao_Paulo",
  });
}

async function getHandler(request, response) {
  await requireUser(request, { roles: STAFF_ROLES });
  const { tab, categoryId, search } = request.query;
  const rows = await ticket.listQueue({ tab, categoryId, search, limit: 1000 });

  const header = [
    "ID",
    "Assunto",
    "Categoria",
    "Solicitante",
    "Responsável",
    "Prioridade",
    "Status",
    "Aberto em",
    "Prazo SLA",
    "Fechado em",
  ];
  const lines = rows.map((row) =>
    [
      ticketCode(row.id),
      row.title,
      row.category_name,
      row.requester_name,
      row.assignee_name || "Não atribuído",
      PRIORITY_LABELS[row.priority],
      STATUS_LABELS[row.status],
      formatDate(row.created_at),
      formatDate(row.sla_due_at),
      formatDate(row.closed_at),
    ]
      .map(csvCell)
      .join(";"),
  );

  const date = new Date().toISOString().slice(0, 10);
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="chamados-${date}.csv"`,
  );
  // BOM para o Excel reconhecer UTF-8 (acentos).
  response.status(200).send("﻿" + [header.join(";"), ...lines].join("\r\n"));
}

export default createHandler({ GET: getHandler });
