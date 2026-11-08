import database from "../infra/database.js";

// Remove registros que não servem mais: sessões vencidas, tokens de
// recuperação vencidos/usados, códigos de acesso e registros antigos do
// limite de tentativas. Usado pelo script `maintenance:cleanup` (Docker) e
// pela rota de cron da Vercel (/api/v1/maintenance/cleanup).
async function cleanup() {
  const sessions = await database.query(
    "DELETE FROM sessions WHERE expires_at <= now();",
  );
  const tokens = await database.query(
    `DELETE FROM password_reset_tokens
     WHERE expires_at <= now() - interval '1 day' OR used_at IS NOT NULL;`,
  );
  const codes = await database.query(
    "DELETE FROM login_codes WHERE expires_at <= now() OR used_at IS NOT NULL;",
  );
  const hits = await database.query(
    "DELETE FROM rate_limit_hits WHERE created_at <= now() - interval '1 day';",
  );
  return {
    sessions: sessions.rowCount,
    passwordResetTokens: tokens.rowCount,
    loginCodes: codes.rowCount,
    rateLimitHits: hits.rowCount,
  };
}

const maintenance = { cleanup };

export default maintenance;
