import database from "infra/database.js";
import { runPendingMigrations } from "infra/migrator.js";
import user from "models/user.js";

export const BASE_URL = "http://localhost:3000";
const EMAIL_HTTP_URL = process.env.EMAIL_HTTP_URL;

let counter = 0;

async function clearDatabase() {
  await database.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
}

async function resetDatabase() {
  await clearDatabase();
  await runPendingMigrations();
}

async function createUser(overrides = {}) {
  counter += 1;
  const unique = `${Date.now()}${counter}`;
  const plainPassword = overrides.password || "senha-segura-123";
  const created = await user.create({
    name: overrides.name || `Usuário Teste ${counter}`,
    email: overrides.email || `usuario${unique}@campus.test`,
    phone: overrides.phone,
    password: plainPassword,
    role: overrides.role || "user",
  });
  return { ...created, password: plainPassword };
}

function extractSessionCookie(response) {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("session_id="));
  return cookie ? cookie.split(";")[0] : null;
}

// Lê no Mailpit o último código de acesso enviado para o endereço.
async function getLoginCode(address) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const query = encodeURIComponent(
      `to:"${address}" subject:"código de acesso"`,
    );
    const result = await (
      await fetch(`${EMAIL_HTTP_URL}/api/v1/search?query=${query}`)
    ).json();
    const subject = result.messages?.[0]?.Subject;
    const code = subject?.match(/(\d{6})$/)?.[1];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Nenhum código de acesso enviado para ${address}`);
}

// Segunda etapa: confirma o código e devolve a resposta (com o cookie).
async function verifyCode(challenge, code) {
  return fetch(`${BASE_URL}/api/v1/sessions/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge, code }),
  });
}

// Login completo: senha -> código por e-mail -> sessão.
async function login(account, { portal, remember } = {}) {
  const response = await fetch(`${BASE_URL}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login: account.email,
      password: account.password,
      portal: portal || (account.role === "user" ? "user" : "staff"),
      remember,
    }),
  });
  if (response.status !== 202) {
    throw new Error(`Falha no login de teste: ${response.status}`);
  }
  const { challenge } = await response.json();
  const verified = await verifyCode(
    challenge,
    await getLoginCode(account.email),
  );
  if (verified.status !== 201) {
    throw new Error(`Falha na verificação do código: ${verified.status}`);
  }
  return extractSessionCookie(verified);
}

async function createUserAndLogin(overrides) {
  const account = await createUser(overrides);
  const cookie = await login(account);
  return { ...account, cookie };
}

// Atalho para chamadas JSON autenticadas.
async function api(method, path, { cookie, body, headers } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { status: response.status, data, headers: response.headers };
}

async function deleteAllEmails() {
  await fetch(`${EMAIL_HTTP_URL}/api/v1/messages`, { method: "DELETE" });
}

async function getLastEmail() {
  const list = await (await fetch(`${EMAIL_HTTP_URL}/api/v1/messages`)).json();
  const latest = list.messages?.[0];
  if (!latest) return null;
  const message = await (
    await fetch(`${EMAIL_HTTP_URL}/api/v1/message/${latest.ID}`)
  ).json();
  return {
    to: message.To.map((recipient) => recipient.Address),
    subject: message.Subject,
    text: message.Text,
  };
}

const orchestrator = {
  resetDatabase,
  createUser,
  login,
  getLoginCode,
  verifyCode,
  createUserAndLogin,
  extractSessionCookie,
  api,
  deleteAllEmails,
  getLastEmail,
  end: () => database.end(),
};

export default orchestrator;
