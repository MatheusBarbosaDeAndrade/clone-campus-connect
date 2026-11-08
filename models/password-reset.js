import crypto from "node:crypto";
import database from "../infra/database.js";
import email from "../infra/email.js";
import { ValidationError } from "../infra/errors.js";
import session, { hashToken } from "./session.js";
import user from "./user.js";
import { normalizeEmail, validatePassword } from "./validation.js";

const TOKEN_TTL_MINUTES = 60;

// Sempre conclui sem erro quando o email é válido, exista ou não a conta,
// para não revelar quais emails estão cadastrados.
async function request(rawEmail) {
  const address = normalizeEmail(rawEmail);
  const found = await user.findByEmail(address);
  if (!found || !found.is_active) return;

  const token = crypto.randomBytes(32).toString("hex");
  await database.query(
    `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3));`,
    [hashToken(token), found.id, TOKEN_TTL_MINUTES],
  );

  const link = `${process.env.APP_URL}/redefinir-senha?token=${token}`;
  await email.send({
    to: found.email,
    subject: "CampusConnect - Recuperação de senha",
    text: [
      `Olá, ${found.name}!`,
      "",
      "Recebemos uma solicitação para redefinir a senha da sua conta no CampusConnect.",
      `Acesse o link abaixo (válido por ${TOKEN_TTL_MINUTES} minutos):`,
      "",
      link,
      "",
      "Se você não fez essa solicitação, ignore este email.",
    ].join("\n"),
  });
}

async function reset({ token, password }) {
  validatePassword(password);
  if (typeof token !== "string" || token.length !== 64) {
    throw new ValidationError({
      message: "Link de recuperação inválido.",
      action: "Solicite um novo link de recuperação.",
    });
  }

  await database.transaction(async (client) => {
    const result = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE;`,
      [hashToken(token)],
    );
    const record = result.rows[0];
    if (!record) {
      throw new ValidationError({
        message: "Link de recuperação inválido ou expirado.",
        action: "Solicite um novo link de recuperação.",
      });
    }
    await user.setPassword(record.user_id, password, client);
    await client.query(
      "UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL;",
      [record.user_id],
    );
    // Encerra todas as sessões abertas com a senha antiga.
    await session.destroyAllForUser(record.user_id, client);
  });
}

const passwordReset = { request, reset };

export default passwordReset;
