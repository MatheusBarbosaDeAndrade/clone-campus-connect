import crypto from "node:crypto";
import database from "../infra/database.js";

// O token só existe no cookie do navegador; no banco guardamos o SHA-256,
// assim um vazamento da tabela não permite sequestrar sessões.

export const SHORT_SESSION_SECONDS = 60 * 60 * 12; // 12 horas
export const LONG_SESSION_SECONDS = 60 * 60 * 24 * 30; // 30 dias ("Lembrar-me")
const LAST_SEEN_THROTTLE_SECONDS = 60;

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function create(userId, { remember = false } = {}) {
  // Aproveita o login para remover as sessões vencidas deste usuário.
  await database.query(
    "DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now();",
    [userId],
  );
  const token = crypto.randomBytes(48).toString("hex");
  const maxAgeSeconds = remember ? LONG_SESSION_SECONDS : SHORT_SESSION_SECONDS;
  await database.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3));`,
    [hashToken(token), userId, maxAgeSeconds],
  );
  await database.query("UPDATE users SET last_seen_at = now() WHERE id = $1;", [
    userId,
  ]);
  return { token, maxAgeSeconds };
}

async function findUserByToken(token) {
  if (typeof token !== "string" || token.length !== 96) return null;
  const result = await database.query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.last_seen_at, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active;`,
    [hashToken(token)],
  );
  const found = result.rows[0];
  if (!found) return null;

  // Atualiza o "visto por último" (usado no status Online/Ausente da equipe)
  // no máximo uma vez por minuto para não gerar escrita a cada requisição.
  const lastSeen = found.last_seen_at ? new Date(found.last_seen_at) : null;
  if (
    !lastSeen ||
    Date.now() - lastSeen.getTime() > LAST_SEEN_THROTTLE_SECONDS * 1000
  ) {
    await database.query(
      "UPDATE users SET last_seen_at = now() WHERE id = $1;",
      [found.id],
    );
  }
  return found;
}

async function destroy(token) {
  if (typeof token !== "string") return;
  await database.query("DELETE FROM sessions WHERE token_hash = $1;", [
    hashToken(token),
  ]);
}

async function destroyAllForUser(userId, client = database) {
  await client.query("DELETE FROM sessions WHERE user_id = $1;", [userId]);
}

async function destroyOthersForUser(userId, keepToken) {
  await database.query(
    "DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2;",
    [userId, hashToken(String(keepToken ?? ""))],
  );
}

const session = {
  create,
  findUserByToken,
  destroy,
  destroyAllForUser,
  destroyOthersForUser,
};

export default session;
