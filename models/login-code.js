import crypto from "node:crypto";
import database from "../infra/database.js";
import email from "../infra/email.js";
import { UnauthorizedError, ValidationError } from "../infra/errors.js";
import { hashToken } from "./session.js";

// Verificação em duas etapas por e-mail. Fluxo:
// 1. `start` (após senha correta ou cadastro): gera um código de 6 dígitos,
//    envia por e-mail e devolve um "challenge" aleatório ao navegador.
// 2. `verify`: recebe o challenge + código; se conferirem, devolve o usuário
//    para que a rota crie a sessão.

export const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;

const INVALID_CHALLENGE = {
  message: "Este código expirou ou não é mais válido.",
  action: "Volte e entre novamente para receber um novo código.",
};

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// "joao.silva@campus.edu" -> "jo•••••••@campus.edu"
export function maskEmail(address) {
  const [local, domain] = String(address).split("@");
  if (!domain) return address;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

async function start(account, { remember = false } = {}) {
  const challenge = crypto.randomBytes(32).toString("hex");
  const code = generateCode();

  // Um novo código invalida os anteriores ainda não usados desta conta.
  await database.query(
    "DELETE FROM login_codes WHERE user_id = $1 AND used_at IS NULL;",
    [account.id],
  );
  await database.query(
    `INSERT INTO login_codes (challenge_hash, user_id, code_hash, remember, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5));`,
    [
      hashToken(challenge),
      account.id,
      hashToken(code),
      Boolean(remember),
      CODE_TTL_MINUTES,
    ],
  );

  await email.send({
    to: account.email,
    subject: `CampusConnect - Seu código de acesso: ${code}`,
    text: [
      `Olá, ${account.name}!`,
      "",
      "Use o código abaixo para concluir o acesso ao CampusConnect:",
      "",
      `    ${code}`,
      "",
      `O código é válido por ${CODE_TTL_MINUTES} minutos e só pode ser usado uma vez.`,
      "",
      "Se não foi você quem tentou entrar, ignore este e-mail e considere trocar sua senha.",
    ].join("\n"),
  });

  return {
    challenge,
    email: maskEmail(account.email),
    expiresInMinutes: CODE_TTL_MINUTES,
  };
}

async function verify({ challenge, code }) {
  if (typeof challenge !== "string" || challenge.length !== 64) {
    throw new UnauthorizedError(INVALID_CHALLENGE);
  }
  const normalizedCode = String(code ?? "").replace(/\D/g, "");
  if (normalizedCode.length !== 6) {
    throw new ValidationError({
      field: "code",
      message: "Informe o código de 6 dígitos enviado ao seu e-mail.",
    });
  }

  return database
    .transaction(async (client) => {
      const result = await client.query(
        `SELECT lc.id, lc.user_id, lc.code_hash, lc.remember, lc.attempts,
              u.role, u.is_active
       FROM login_codes lc
       JOIN users u ON u.id = lc.user_id
       WHERE lc.challenge_hash = $1 AND lc.used_at IS NULL
         AND lc.expires_at > now()
       FOR UPDATE OF lc;`,
        [hashToken(challenge)],
      );
      const record = result.rows[0];
      if (
        !record ||
        record.attempts >= MAX_CODE_ATTEMPTS ||
        !record.is_active
      ) {
        throw new UnauthorizedError(INVALID_CHALLENGE);
      }

      const matches = crypto.timingSafeEqual(
        Buffer.from(hashToken(normalizedCode)),
        Buffer.from(record.code_hash),
      );
      if (!matches) {
        const attempts = record.attempts + 1;
        await client.query(
          "UPDATE login_codes SET attempts = $2 WHERE id = $1;",
          [record.id, attempts],
        );
        const left = MAX_CODE_ATTEMPTS - attempts;
        if (left <= 0) {
          // Erro "normal" (não exceção) para o UPDATE acima ser gravado.
          return {
            error: new UnauthorizedError({
              message: "Código incorreto. O limite de tentativas foi atingido.",
              action: "Volte e entre novamente para receber um novo código.",
            }),
          };
        }
        return {
          error: new ValidationError({
            field: "code",
            message: `Código incorreto. ${left === 1 ? "Resta 1 tentativa" : `Restam ${left} tentativas`}.`,
          }),
        };
      }

      await client.query(
        "UPDATE login_codes SET used_at = now() WHERE id = $1;",
        [record.id],
      );
      return {
        user: { id: record.user_id, role: record.role },
        remember: record.remember,
      };
    })
    .then((outcome) => {
      if (outcome.error) throw outcome.error;
      return outcome;
    });
}

const loginCode = { start, verify };

export default loginCode;
