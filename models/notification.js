import database from "../infra/database.js";
import { NotFoundError } from "../infra/errors.js";

// Cria notificações para uma lista de usuários (ignora duplicados e o
// próprio autor da ação, que não precisa ser notificado do que fez).
async function notify(
  client,
  { userIds, excludeUserId, type, title, body, ticketId },
) {
  const recipients = [...new Set(userIds.filter(Boolean))].filter(
    (id) => id !== excludeUserId,
  );
  for (const userId of recipients) {
    await client.query(
      `INSERT INTO notifications (user_id, type, title, body, ticket_id)
       VALUES ($1, $2, $3, $4, $5);`,
      [userId, type, title, body, ticketId ?? null],
    );
  }
}

async function listForUser(userId, { limit = 100 } = {}) {
  const result = await database.query(
    `SELECT id, type, title, body, ticket_id, read_at, created_at
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC, id DESC LIMIT $2;`,
    [userId, limit],
  );
  return result.rows;
}

async function countUnread(userId) {
  const result = await database.query(
    "SELECT count(*)::int AS total FROM notifications WHERE user_id = $1 AND read_at IS NULL;",
    [userId],
  );
  return result.rows[0].total;
}

async function markRead(id, userId) {
  const result = await database.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND user_id = $2 RETURNING id, ticket_id, read_at;`,
    [id, userId],
  );
  if (result.rowCount === 0) {
    throw new NotFoundError({ message: "Notificação não encontrada." });
  }
  return result.rows[0];
}

async function markAllRead(userId) {
  await database.query(
    "UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL;",
    [userId],
  );
}

const notification = {
  notify,
  listForUser,
  countUnread,
  markRead,
  markAllRead,
};

export default notification;
