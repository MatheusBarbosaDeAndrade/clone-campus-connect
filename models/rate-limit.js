import database from "../infra/database.js";
import { TooManyRequestsError } from "../infra/errors.js";
import { hashToken } from "./session.js";

// Limites por "balde". Cada balde conta eventos de uma chave (conta ou IP)
// dentro de uma janela deslizante. Os limites por IP são folgados porque,
// em um campus, muitos alunos saem pelo mesmo IP (NAT da rede da faculdade).
export const RULES = {
  // Falhas de login por conta (email/telefone digitado): defesa principal
  // contra força bruta. Um login correto zera o contador.
  "login:account": { max: 10, windowSeconds: 15 * 60 },
  // Falhas de login por IP (tentativas em muitas contas a partir da mesma origem).
  "login:ip": { max: 100, windowSeconds: 15 * 60 },
  // Senha atual incorreta na troca de senha (sessão roubada tentando adivinhar).
  "password-change:user": { max: 10, windowSeconds: 15 * 60 },
  // Pedidos de recuperação de senha (evita usar o sistema para spam).
  "reset:email": { max: 3, windowSeconds: 60 * 60 },
  "reset:ip": { max: 20, windowSeconds: 60 * 60 },
  // Contas criadas por IP.
  "signup:ip": { max: 30, windowSeconds: 60 * 60 },
  // Códigos de acesso enviados por e-mail para a mesma conta (evita spam e
  // limita as tentativas de adivinhar o código: 5 códigos x 5 tentativas).
  "login-code:account": { max: 5, windowSeconds: 15 * 60 },
};

const MESSAGES = {
  "login:account": "Muitas tentativas de login sem sucesso para esta conta.",
  "login:ip": "Muitas tentativas de login sem sucesso a partir desta rede.",
  "password-change:user": "Muitas tentativas com a senha atual incorreta.",
  "reset:email":
    "Já enviamos vários links de recuperação para este email recentemente.",
  "reset:ip": "Muitos pedidos de recuperação de senha a partir desta rede.",
  "signup:ip": "Muitas contas criadas a partir desta rede recentemente.",
  "login-code:account":
    "Já enviamos vários códigos de acesso para esta conta recentemente.",
};

function ruleFor(bucket) {
  const rule = RULES[bucket];
  if (!rule) throw new Error(`Balde de limite desconhecido: ${bucket}`);
  return rule;
}

function normalizeKey(key) {
  return hashToken(
    String(key ?? "")
      .trim()
      .toLowerCase(),
  );
}

// Lança TooManyRequestsError se a chave já atingiu o limite na janela.
async function check(bucket, key) {
  const { max, windowSeconds } = ruleFor(bucket);
  const result = await database.query(
    `SELECT count(*)::int AS total, min(created_at) AS oldest
     FROM rate_limit_hits
     WHERE bucket = $1 AND key_hash = $2
       AND created_at > now() - make_interval(secs => $3);`,
    [bucket, normalizeKey(key), windowSeconds],
  );
  const { total, oldest } = result.rows[0];
  if (total >= max) {
    const elapsed = (Date.now() - new Date(oldest).getTime()) / 1000;
    throw new TooManyRequestsError({
      message: MESSAGES[bucket],
      retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds - elapsed)),
    });
  }
}

async function hit(bucket, key) {
  ruleFor(bucket);
  await database.query(
    "INSERT INTO rate_limit_hits (bucket, key_hash) VALUES ($1, $2);",
    [bucket, normalizeKey(key)],
  );
}

// Verifica e já registra o evento (para ações contadas sempre, com ou sem sucesso).
async function consume(bucket, key) {
  await check(bucket, key);
  await hit(bucket, key);
}

async function reset(bucket, key) {
  await database.query(
    "DELETE FROM rate_limit_hits WHERE bucket = $1 AND key_hash = $2;",
    [bucket, normalizeKey(key)],
  );
}

const rateLimit = { check, hit, consume, reset };

export default rateLimit;
