import crypto from "node:crypto";
import database from "../infra/database.js";
import { ForbiddenError, ValidationError } from "../infra/errors.js";
import { ANONYMIZED_NAME } from "../lib/privacy.js";
import password from "./password.js";
import session from "./session.js";

// Direitos do titular (LGPD, art. 18): acesso/portabilidade (exportação) e
// eliminação dos dados pessoais (aqui feita por anonimização: os chamados
// continuam no histórico do atendimento, sem identificar a pessoa).

async function exportData(userId) {
  const profile = await database.query(
    `SELECT id, name, email, phone, role, created_at, updated_at, last_seen_at,
            privacy_accepted_at, privacy_version
     FROM users WHERE id = $1;`,
    [userId],
  );
  const tickets = await database.query(
    `SELECT t.id, t.title, t.description, c.name AS category, t.priority,
            t.status, t.created_at, t.updated_at, t.closed_at
     FROM tickets t JOIN categories c ON c.id = t.category_id
     WHERE t.requester_id = $1 ORDER BY t.id;`,
    [userId],
  );
  const messages = await database.query(
    `SELECT m.ticket_id, m.body, m.created_at,
            (m.author_id = $1) AS sent_by_me
     FROM ticket_messages m JOIN tickets t ON t.id = m.ticket_id
     WHERE t.requester_id = $1 AND NOT m.is_internal
     ORDER BY m.ticket_id, m.created_at;`,
    [userId],
  );
  const attachments = await database.query(
    `SELECT a.ticket_id, a.filename, a.mime_type, a.size_bytes, a.created_at
     FROM ticket_attachments a JOIN tickets t ON t.id = a.ticket_id
     WHERE a.uploader_id = $1 OR t.requester_id = $1
     ORDER BY a.ticket_id, a.created_at;`,
    [userId],
  );
  const notifications = await database.query(
    `SELECT type, title, body, ticket_id, read_at, created_at
     FROM notifications WHERE user_id = $1 ORDER BY created_at;`,
    [userId],
  );

  const messagesByTicket = Map.groupBy(messages.rows, (row) => row.ticket_id);
  const attachmentsByTicket = Map.groupBy(
    attachments.rows,
    (row) => row.ticket_id,
  );

  return {
    exported_at: new Date().toISOString(),
    profile: profile.rows[0],
    tickets: tickets.rows.map((ticket) => ({
      ...ticket,
      messages: (messagesByTicket.get(ticket.id) || []).map(
        ({ ticket_id: _ticketId, ...message }) => message,
      ),
      attachments: (attachmentsByTicket.get(ticket.id) || []).map(
        ({ ticket_id: _ticketId, ...attachment }) => attachment,
      ),
    })),
    notifications: notifications.rows,
  };
}

// Exclusão da conta a pedido do próprio usuário. Contas da equipe não se
// autoexcluem (um gestor as desativa), para não deixar a gestão sem acesso.
async function anonymize(userId, { currentPassword }) {
  const result = await database.query(
    "SELECT id, name, role, password_hash FROM users WHERE id = $1;",
    [userId],
  );
  const found = result.rows[0];
  if (found.role !== "user") {
    throw new ForbiddenError({
      message: "Contas da equipe não podem ser excluídas pelo próprio perfil.",
      action: "Peça a um gestor para desativar a sua conta.",
    });
  }
  const matches = await password.compare(currentPassword, found.password_hash);
  if (!matches) {
    throw new ValidationError({
      field: "currentPassword",
      message: "A senha está incorreta.",
    });
  }

  await database.transaction(async (client) => {
    // Email fictício e único (o email é obrigatório e único na tabela);
    // o hash de senha inválido impede qualquer login futuro.
    await client.query(
      `UPDATE users
       SET name = $2, email = $3, phone = NULL, password_hash = 'anonimizado',
           is_active = false, last_seen_at = NULL, anonymized_at = now(),
           updated_at = now()
       WHERE id = $1;`,
      [
        userId,
        ANONYMIZED_NAME,
        `removido-${crypto.randomUUID()}@anonimizado.invalid`,
      ],
    );
    // O nome aparecia no texto de notificações enviadas à equipe.
    await client.query(
      `UPDATE notifications SET body = replace(body, $2, $3)
       WHERE ticket_id IN (SELECT id FROM tickets WHERE requester_id = $1);`,
      [userId, found.name, ANONYMIZED_NAME],
    );
    await client.query("DELETE FROM notifications WHERE user_id = $1;", [
      userId,
    ]);
    await client.query(
      "DELETE FROM password_reset_tokens WHERE user_id = $1;",
      [userId],
    );
    await client.query("DELETE FROM login_codes WHERE user_id = $1;", [userId]);
    await session.destroyAllForUser(userId, client);
  });
}

const account = { exportData, anonymize };

export default account;
