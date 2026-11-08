import path from "node:path";
import { ATTACHMENT_MAX_MB, MAX_ATTACHMENT_BYTES } from "../lib/attachments.js";
import database from "../infra/database.js";
import {
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  ValidationError,
} from "../infra/errors.js";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  QUEUE_TABS,
  SLA_RISK_THRESHOLD_MINUTES,
  STATUSES,
  STATUS_LABELS,
  ticketCode,
} from "../lib/ticket-labels.js";
import assignmentRule from "./assignment-rule.js";
import category from "./category.js";
import notification from "./notification.js";
import sla from "./sla.js";
import user from "./user.js";
import { isUuid, parseId, requireOneOf, requireText } from "./validation.js";

const STAFF_ROLES = ["agent", "manager"];
export { MAX_ATTACHMENT_BYTES };
const MAX_ATTACHMENTS_PER_TICKET = 10;

// Tipos aceitos, validados também pela assinatura binária do arquivo.
const ALLOWED_FILES = {
  "image/png": (b) =>
    b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  "image/jpeg": (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "application/pdf": (b) => b.subarray(0, 4).toString("latin1") === "%PDF",
};

export function isStaff(account) {
  return STAFF_ROLES.includes(account?.role);
}

function timezone() {
  return process.env.APP_TIMEZONE || "America/Sao_Paulo";
}

const BASE_SELECT = `
  SELECT t.id, t.title, t.description, t.priority, t.status,
         t.category_id, c.name AS category_name,
         t.requester_id, r.name AS requester_name, r.role AS requester_role,
         t.assignee_id, a.name AS assignee_name,
         t.sla_started_at, t.sla_due_at, t.first_response_at, t.closed_at,
         t.created_at, t.updated_at
  FROM tickets t
  JOIN categories c ON c.id = t.category_id
  JOIN users r ON r.id = t.requester_id
  LEFT JOIN users a ON a.id = t.assignee_id
`;

function validateCreateInput(input) {
  return {
    title: requireText(input.title, {
      field: "title",
      label: "O assunto",
      min: 5,
      max: 150,
    }),
    description: requireText(input.description, {
      field: "description",
      label: "A descrição",
      min: 10,
      max: 5000,
    }),
    categoryId: parseId(input.categoryId, { label: "Categoria" }),
    priority: requireOneOf(input.priority, PRIORITIES, {
      field: "priority",
      label: "Prioridade",
    }),
  };
}

async function addEvent(
  client,
  { ticketId, actorId, type, from, to, internal = false },
) {
  await client.query(
    `INSERT INTO ticket_events (ticket_id, actor_id, type, from_value, to_value, is_internal)
     VALUES ($1, $2, $3, $4, $5, $6);`,
    [ticketId, actorId ?? null, type, from ?? null, to ?? null, internal],
  );
}

async function create(requester, input) {
  if (requester.role !== "user") {
    throw new ForbiddenError({
      message: "Chamados são abertos pelo portal do usuário.",
    });
  }
  const data = validateCreateInput(input);

  return database.transaction(async (client) => {
    await category.findActiveById(data.categoryId, client);
    const hours = await sla.getHours(data.priority, client);
    const assigneeId = await assignmentRule.findAgentForCategory(
      data.categoryId,
      client,
    );

    const result = await client.query(
      `INSERT INTO tickets
         (title, description, category_id, priority, requester_id, assignee_id,
          sla_started_at, sla_due_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now() + make_interval(hours => $7))
       RETURNING id;`,
      [
        data.title,
        data.description,
        data.categoryId,
        data.priority,
        requester.id,
        assigneeId,
        hours,
      ],
    );
    const ticketId = result.rows[0].id;
    const code = ticketCode(ticketId);

    await addEvent(client, {
      ticketId,
      actorId: requester.id,
      type: "created",
      to: "aberto",
    });

    if (assigneeId) {
      const assignee = await client.query(
        "SELECT name FROM users WHERE id = $1;",
        [assigneeId],
      );
      await addEvent(client, {
        ticketId,
        actorId: null,
        type: "assigned",
        to: assignee.rows[0].name,
      });
      await notification.notify(client, {
        userIds: [assigneeId],
        excludeUserId: requester.id,
        type: "ticket_assigned",
        title: "Chamado atribuído a você",
        body: `O chamado ${code} "${data.title}" foi atribuído automaticamente a você.`,
        ticketId,
      });
    } else {
      await notification.notify(client, {
        userIds: await user.listManagerIds(client),
        excludeUserId: requester.id,
        type: "ticket_created",
        title: "Novo chamado na fila",
        body: `${code} "${data.title}" aguarda atribuição.`,
        ticketId,
      });
    }

    return { id: ticketId };
  });
}

// Carrega o chamado garantindo que o usuário pode vê-lo. Para usuários
// comuns, chamados de terceiros retornam 404 (não revelam que existem).
async function getAccessible(
  id,
  viewer,
  client = database,
  { lock = false } = {},
) {
  const ticketId = parseId(id, { label: "Chamado" });
  const result = await client.query(
    lock
      ? "SELECT * FROM tickets WHERE id = $1 FOR UPDATE;"
      : "SELECT * FROM tickets WHERE id = $1;",
    [ticketId],
  );
  const row = result.rows[0];
  if (!row || (!isStaff(viewer) && row.requester_id !== viewer.id)) {
    throw new NotFoundError({ message: "Chamado não encontrado." });
  }
  return row;
}

async function findForViewer(id, viewer) {
  const base = await getAccessible(id, viewer);
  const staff = isStaff(viewer);

  const [ticketResult, events, messages, attachments] = await Promise.all([
    database.query(`${BASE_SELECT} WHERE t.id = $1;`, [base.id]),
    database.query(
      `SELECT e.id, e.type, e.from_value, e.to_value, e.is_internal, e.created_at,
              u.name AS actor_name, u.role AS actor_role
       FROM ticket_events e LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.ticket_id = $1 AND ($2 OR NOT e.is_internal)
       ORDER BY e.created_at, e.id;`,
      [base.id, staff],
    ),
    database.query(
      `SELECT m.id, m.body, m.is_internal, m.created_at, m.author_id,
              u.name AS author_name, u.role AS author_role
       FROM ticket_messages m JOIN users u ON u.id = m.author_id
       WHERE m.ticket_id = $1 AND ($2 OR NOT m.is_internal)
       ORDER BY m.created_at, m.id;`,
      [base.id, staff],
    ),
    database.query(
      `SELECT a.id, a.filename, a.mime_type, a.size_bytes, a.created_at,
              u.name AS uploader_name
       FROM ticket_attachments a JOIN users u ON u.id = a.uploader_id
       WHERE a.ticket_id = $1 ORDER BY a.created_at;`,
      [base.id],
    ),
  ]);

  return {
    ticket: ticketResult.rows[0],
    events: events.rows,
    messages: messages.rows,
    attachments: attachments.rows,
  };
}

function buildSearchClause(search, params) {
  if (typeof search !== "string" || search.trim() === "") return "";
  const term = search.trim().slice(0, 100);
  params.push(`%${term}%`);
  const like = `$${params.length}`;
  const digits = term.replace(/^#/, "");
  if (/^\d{1,9}$/.test(digits)) {
    params.push(Number(digits));
    return ` AND (t.title ILIKE ${like} OR t.description ILIKE ${like} OR t.id = $${params.length})`;
  }
  return ` AND (t.title ILIKE ${like} OR t.description ILIKE ${like} OR r.name ILIKE ${like})`;
}

const USER_SORTS = {
  recent: "t.updated_at DESC, t.id DESC",
  oldest: "t.created_at ASC, t.id ASC",
  priority:
    "array_position(ARRAY['critica','alta','media','baixa']::varchar[], t.priority), t.updated_at DESC",
};

async function listForRequester(
  requesterId,
  { search, status, sort, limit } = {},
) {
  const params = [requesterId];
  let where = "WHERE t.requester_id = $1";
  if (STATUSES.includes(status)) {
    params.push(status);
    where += ` AND t.status = $${params.length}`;
  }
  where += buildSearchClause(search, params);
  const order = USER_SORTS[sort] || USER_SORTS.recent;
  params.push(Math.min(Number(limit) || 200, 500));
  const result = await database.query(
    `${BASE_SELECT} ${where} ORDER BY ${order} LIMIT $${params.length};`,
    params,
  );
  return result.rows;
}

async function countsForRequester(requesterId) {
  const result = await database.query(
    `SELECT
       count(*) FILTER (WHERE status IN ('aberto', 'reaberto'))::int AS open,
       count(*) FILTER (WHERE status IN ('em_analise', 'em_andamento', 'aguardando'))::int AS in_progress,
       count(*) FILTER (WHERE status = 'fechado')::int AS closed
     FROM tickets WHERE requester_id = $1;`,
    [requesterId],
  );
  return result.rows[0];
}

export { QUEUE_TABS };

const QUEUE_TAB_FILTERS = {
  all: "TRUE",
  unassigned: "t.assignee_id IS NULL AND t.status <> 'fechado'",
  critical: "t.priority = 'critica' AND t.status <> 'fechado'",
  sla_risk: `t.status <> 'fechado' AND t.sla_due_at < now() + interval '${SLA_RISK_THRESHOLD_MINUTES} minutes'`,
};

async function listQueue({ tab = "all", categoryId, search, limit } = {}) {
  const params = [];
  let where = `WHERE ${QUEUE_TAB_FILTERS[tab] || QUEUE_TAB_FILTERS.all}`;
  if (categoryId) {
    params.push(parseId(categoryId, { label: "Categoria" }));
    where += ` AND t.category_id = $${params.length}`;
  }
  where += buildSearchClause(search, params);
  params.push(Math.min(Number(limit) || 200, 1000));
  const result = await database.query(
    `${BASE_SELECT} ${where}
     ORDER BY (t.status = 'fechado'), t.sla_due_at ASC, t.id DESC
     LIMIT $${params.length};`,
    params,
  );
  return result.rows;
}

async function queueCounts() {
  const result = await database.query(
    `SELECT
       count(*)::int AS "all",
       count(*) FILTER (WHERE ${QUEUE_TAB_FILTERS.unassigned})::int AS unassigned,
       count(*) FILTER (WHERE ${QUEUE_TAB_FILTERS.critical})::int AS critical,
       count(*) FILTER (WHERE ${QUEUE_TAB_FILTERS.sla_risk})::int AS sla_risk,
       count(*) FILTER (WHERE t.status IN ('em_analise', 'em_andamento'))::int AS in_progress,
       count(*) FILTER (WHERE t.status = 'aguardando')::int AS waiting,
       count(*) FILTER (
         WHERE t.closed_at >= (date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)
       )::int AS resolved_today
     FROM tickets t;`,
    [timezone()],
  );
  return result.rows[0];
}

async function assertAssignable(assigneeId, client) {
  if (!isUuid(assigneeId)) {
    throw new ValidationError({
      field: "assigneeId",
      message: "Responsável inválido.",
    });
  }
  const result = await client.query(
    "SELECT id, name FROM users WHERE id = $1 AND role IN ('agent', 'manager') AND is_active;",
    [assigneeId],
  );
  if (result.rowCount === 0) {
    throw new ValidationError({
      field: "assigneeId",
      message: "O responsável selecionado não faz parte da equipe ativa.",
    });
  }
  return result.rows[0];
}

// Aplica uma mudança de status, cuidando de fechamento/reabertura e SLA.
async function applyStatus(client, current, newStatus, actorId) {
  const code = ticketCode(current.id);
  if (newStatus === "fechado") {
    await client.query(
      "UPDATE tickets SET status = 'fechado', closed_at = now(), updated_at = now() WHERE id = $1;",
      [current.id],
    );
  } else if (current.status === "fechado") {
    // Reabertura: o prazo de SLA é reiniciado a partir de agora.
    const hours = await sla.getHours(current.priority, client);
    await client.query(
      `UPDATE tickets SET status = $2, closed_at = NULL, sla_started_at = now(),
         sla_due_at = now() + make_interval(hours => $3), updated_at = now()
       WHERE id = $1;`,
      [current.id, newStatus, hours],
    );
  } else {
    await client.query(
      "UPDATE tickets SET status = $2, updated_at = now() WHERE id = $1;",
      [current.id, newStatus],
    );
  }

  const reopened = current.status === "fechado" && newStatus !== "fechado";
  await addEvent(client, {
    ticketId: current.id,
    actorId,
    type: reopened
      ? "reopened"
      : newStatus === "fechado"
        ? "closed"
        : "status_changed",
    from: current.status,
    to: newStatus,
  });

  const recipients =
    actorId === current.requester_id
      ? [current.assignee_id || null].concat(
          current.assignee_id ? [] : await user.listManagerIds(client),
        )
      : [current.requester_id, current.assignee_id];

  const verb = reopened
    ? "foi reaberto"
    : newStatus === "fechado"
      ? "foi fechado"
      : `foi atualizado para '${STATUS_LABELS[newStatus]}'`;
  await notification.notify(client, {
    userIds: recipients,
    excludeUserId: actorId,
    type: reopened
      ? "ticket_reopened"
      : newStatus === "fechado"
        ? "ticket_closed"
        : "ticket_updated",
    title: reopened
      ? "Chamado Reaberto"
      : newStatus === "fechado"
        ? "Chamado Fechado"
        : "Chamado Atualizado",
    body: `O chamado ${code} "${current.title}" ${verb}.`,
    ticketId: current.id,
  });
}

async function applyPriority(
  client,
  current,
  newPriority,
  actorId,
  { type = "priority_changed" } = {},
) {
  const hours = await sla.getHours(newPriority, client);
  await client.query(
    `UPDATE tickets SET priority = $2,
       sla_due_at = sla_started_at + make_interval(hours => $3), updated_at = now()
     WHERE id = $1;`,
    [current.id, newPriority, hours],
  );
  await addEvent(client, {
    ticketId: current.id,
    actorId,
    type,
    from: current.priority,
    to: newPriority,
  });
}

// Alterações feitas pela equipe (agentes e gestores).
async function updateByStaff(id, actor, input) {
  if (!isStaff(actor)) throw new ForbiddenError();

  return database.transaction(async (client) => {
    const current = await getAccessible(id, actor, client, { lock: true });
    const code = ticketCode(current.id);

    if (input.priority !== undefined && input.priority !== current.priority) {
      requireOneOf(input.priority, PRIORITIES, {
        field: "priority",
        label: "Prioridade",
      });
      await applyPriority(client, current, input.priority, actor.id);
      await notification.notify(client, {
        userIds: [current.assignee_id],
        excludeUserId: actor.id,
        type: "ticket_updated",
        title: "Prioridade alterada",
        body: `A prioridade do chamado ${code} mudou de ${PRIORITY_LABELS[current.priority]} para ${PRIORITY_LABELS[input.priority]}.`,
        ticketId: current.id,
      });
    }

    if (
      input.assigneeId !== undefined &&
      input.assigneeId !== current.assignee_id
    ) {
      if (input.assigneeId === null || input.assigneeId === "") {
        await client.query(
          "UPDATE tickets SET assignee_id = NULL, updated_at = now() WHERE id = $1;",
          [current.id],
        );
        await addEvent(client, {
          ticketId: current.id,
          actorId: actor.id,
          type: "unassigned",
        });
      } else {
        const assignee = await assertAssignable(input.assigneeId, client);
        await client.query(
          "UPDATE tickets SET assignee_id = $2, updated_at = now() WHERE id = $1;",
          [current.id, assignee.id],
        );
        await addEvent(client, {
          ticketId: current.id,
          actorId: actor.id,
          type: "assigned",
          to: assignee.name,
        });
        await notification.notify(client, {
          userIds: [assignee.id],
          excludeUserId: actor.id,
          type: "ticket_assigned",
          title: "Chamado atribuído a você",
          body: `O chamado ${code} "${current.title}" foi atribuído a você.`,
          ticketId: current.id,
        });
      }
    }

    if (input.status !== undefined && input.status !== current.status) {
      requireOneOf(input.status, STATUSES, {
        field: "status",
        label: "Status",
      });
      const fresh = (
        await client.query("SELECT * FROM tickets WHERE id = $1;", [current.id])
      ).rows[0];
      await applyStatus(client, fresh, input.status, actor.id);
    }

    return { id: current.id };
  });
}

// O solicitante pode apenas fechar o próprio chamado ou reabri-lo.
async function updateStatusByRequester(id, requester, status) {
  return database.transaction(async (client) => {
    const current = await getAccessible(id, requester, client, { lock: true });
    if (current.requester_id !== requester.id) throw new ForbiddenError();

    if (status === "fechado") {
      if (current.status === "fechado") {
        throw new ValidationError({ message: "Este chamado já está fechado." });
      }
    } else if (status === "reaberto") {
      if (current.status !== "fechado") {
        throw new ValidationError({
          message: "Apenas chamados fechados podem ser reabertos.",
        });
      }
    } else {
      throw new ForbiddenError({
        message: "Você só pode fechar ou reabrir o seu chamado.",
      });
    }

    await applyStatus(client, current, status, requester.id);
    return { id: current.id };
  });
}

async function addMessage(id, author, input) {
  const body = requireText(input.body, {
    field: "body",
    label: "A mensagem",
    max: 5000,
  });
  const internal = Boolean(input.internal);
  const staff = isStaff(author);
  if (internal && !staff) {
    throw new ForbiddenError({
      message: "Apenas a equipe pode criar notas internas.",
    });
  }

  return database.transaction(async (client) => {
    const current = await getAccessible(id, author, client, { lock: true });
    if (!internal && current.status === "fechado") {
      throw new ValidationError({
        message: "Este chamado está fechado.",
        action: "Reabra o chamado para enviar novas mensagens.",
      });
    }

    const result = await client.query(
      `INSERT INTO ticket_messages (ticket_id, author_id, body, is_internal)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at;`,
      [current.id, author.id, body, internal],
    );

    const firstResponse =
      staff &&
      !internal &&
      !current.first_response_at &&
      author.id !== current.requester_id;
    await client.query(
      `UPDATE tickets SET updated_at = now()
         ${firstResponse ? ", first_response_at = now()" : ""}
       WHERE id = $1;`,
      [current.id],
    );

    const code = ticketCode(current.id);
    if (internal) {
      await addEvent(client, {
        ticketId: current.id,
        actorId: author.id,
        type: "note_added",
        internal: true,
      });
    } else if (author.id === current.requester_id) {
      await notification.notify(client, {
        userIds: current.assignee_id
          ? [current.assignee_id]
          : await user.listManagerIds(client),
        excludeUserId: author.id,
        type: "new_message",
        title: "Nova mensagem do solicitante",
        body: `${author.name} enviou uma mensagem no chamado ${code}.`,
        ticketId: current.id,
      });
    } else {
      await addEvent(client, {
        ticketId: current.id,
        actorId: author.id,
        type: "responded",
      });
      await notification.notify(client, {
        userIds: [current.requester_id, current.assignee_id],
        excludeUserId: author.id,
        type: "new_message",
        title: "Novo Comentário",
        body: `${author.name} respondeu ao chamado ${code} "${current.title}".`,
        ticketId: current.id,
      });
    }
    return result.rows[0];
  });
}

// Escalonamento: eleva a prioridade em um nível (quando possível) e avisa
// gestores e responsável.
async function escalate(id, actor) {
  if (!isStaff(actor)) throw new ForbiddenError();
  return database.transaction(async (client) => {
    const current = await getAccessible(id, actor, client, { lock: true });
    if (current.status === "fechado") {
      throw new ValidationError({
        message: "Chamados fechados não podem ser escalados.",
      });
    }
    const index = PRIORITIES.indexOf(current.priority);
    const next = PRIORITIES[Math.min(index + 1, PRIORITIES.length - 1)];

    if (next !== current.priority) {
      await applyPriority(client, current, next, actor.id, {
        type: "escalated",
      });
    } else {
      await addEvent(client, {
        ticketId: current.id,
        actorId: actor.id,
        type: "escalated",
        from: current.priority,
        to: current.priority,
      });
    }

    const managers = await user.listManagerIds(client);
    await notification.notify(client, {
      userIds: [...managers, current.assignee_id],
      excludeUserId: actor.id,
      type: "ticket_escalated",
      title: "Chamado escalado",
      body: `${actor.name} escalou o chamado ${ticketCode(current.id)} "${current.title}" (prioridade ${PRIORITY_LABELS[next]}).`,
      ticketId: current.id,
    });
    return { id: current.id, priority: next };
  });
}

function sanitizeFilename(raw) {
  const decoded = (() => {
    try {
      return decodeURIComponent(String(raw || ""));
    } catch {
      return String(raw || "");
    }
  })();
  const base = path.basename(decoded.replace(/\\/g, "/"));
  const clean = base
    .replace(/[\u0000-\u001f"<>|]/g, "")
    .trim()
    .slice(0, 255);
  return clean || "arquivo";
}

async function addAttachment(id, uploader, { filename, mimeType, buffer }) {
  const validator = ALLOWED_FILES[mimeType];
  if (!validator) {
    throw new ValidationError({
      field: "file",
      message: "Tipo de arquivo não permitido. Envie PNG, JPG ou PDF.",
    });
  }
  if (!buffer || buffer.length === 0) {
    throw new ValidationError({
      field: "file",
      message: "O arquivo está vazio.",
    });
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new PayloadTooLargeError({
      message: `O arquivo deve ter no máximo ${ATTACHMENT_MAX_MB} MB.`,
    });
  }
  if (!validator(buffer)) {
    throw new ValidationError({
      field: "file",
      message: "O conteúdo do arquivo não corresponde ao tipo informado.",
    });
  }

  return database.transaction(async (client) => {
    const current = await getAccessible(id, uploader, client, { lock: true });
    const count = await client.query(
      "SELECT count(*)::int AS total FROM ticket_attachments WHERE ticket_id = $1;",
      [current.id],
    );
    if (count.rows[0].total >= MAX_ATTACHMENTS_PER_TICKET) {
      throw new ValidationError({
        message: `Cada chamado aceita no máximo ${MAX_ATTACHMENTS_PER_TICKET} anexos.`,
      });
    }
    const name = sanitizeFilename(filename);
    const result = await client.query(
      `INSERT INTO ticket_attachments (ticket_id, uploader_id, filename, mime_type, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, filename, mime_type, size_bytes, created_at;`,
      [current.id, uploader.id, name, mimeType, buffer.length, buffer],
    );
    await addEvent(client, {
      ticketId: current.id,
      actorId: uploader.id,
      type: "attachment_added",
      to: name,
    });
    await client.query("UPDATE tickets SET updated_at = now() WHERE id = $1;", [
      current.id,
    ]);
    return result.rows[0];
  });
}

async function getAttachment(attachmentId, viewer) {
  if (!isUuid(attachmentId))
    throw new NotFoundError({ message: "Anexo não encontrado." });
  const result = await database.query(
    "SELECT * FROM ticket_attachments WHERE id = $1;",
    [attachmentId],
  );
  const attachment = result.rows[0];
  if (!attachment)
    throw new NotFoundError({ message: "Anexo não encontrado." });
  await getAccessible(attachment.ticket_id, viewer); // checa permissão
  return attachment;
}

const ticket = {
  create,
  findForViewer,
  listForRequester,
  countsForRequester,
  listQueue,
  queueCounts,
  updateByStaff,
  updateStatusByRequester,
  addMessage,
  escalate,
  addAttachment,
  getAttachment,
};

export default ticket;
