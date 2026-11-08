import {
  clearSessionCookie,
  createHandler,
  getClientIp,
  getJsonBody,
  SESSION_COOKIE,
} from "infra/controller.js";
import { UnauthorizedError } from "infra/errors.js";
import authentication from "models/authentication.js";
import loginCode from "models/login-code.js";
import rateLimit from "models/rate-limit.js";
import session from "models/session.js";

// Mesma normalização do login: email em minúsculas ou só os dígitos do
// telefone, para que "(11) 9..." e "119..." contem como a mesma conta.
function loginKey(login) {
  const text = String(login ?? "").trim();
  return text.includes("@") ? text.toLowerCase() : text.replace(/\D/g, "");
}

async function postHandler(request, response) {
  const body = getJsonBody(request);
  const ip = getClientIp(request);
  const accountKey = loginKey(body.login);

  await rateLimit.check("login:ip", ip);
  await rateLimit.check("login:account", accountKey);

  let authenticated;
  try {
    authenticated = await authentication.authenticate({
      login: body.login,
      password: body.password,
      portal: body.portal === "staff" ? "staff" : "user",
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await rateLimit.hit("login:ip", ip);
      await rateLimit.hit("login:account", accountKey);
    }
    throw error;
  }
  await rateLimit.reset("login:account", accountKey);

  // Senha correta: a sessão só é criada depois que o código enviado por
  // e-mail for confirmado em POST /api/v1/sessions/verify.
  await rateLimit.consume("login-code:account", authenticated.id);
  const challenge = await loginCode.start(authenticated, {
    remember: Boolean(body.remember),
  });
  response.status(202).json(challenge);
}

async function deleteHandler(request, response) {
  await session.destroy(request.cookies?.[SESSION_COOKIE]);
  clearSessionCookie(response);
  response.status(200).json({ ok: true });
}

export default createHandler({ POST: postHandler, DELETE: deleteHandler });
