import {
  createHandler,
  getJsonBody,
  setSessionCookie,
} from "infra/controller.js";
import loginCode from "models/login-code.js";
import session from "models/session.js";

// Segunda etapa do login/cadastro: confere o código enviado por e-mail e,
// se estiver certo, cria a sessão.
async function postHandler(request, response) {
  const body = getJsonBody(request);
  const { user, remember } = await loginCode.verify({
    challenge: body.challenge,
    code: body.code,
  });
  const { token, maxAgeSeconds } = await session.create(user.id, { remember });
  setSessionCookie(response, token, { persistent: remember, maxAgeSeconds });
  response.status(201).json({ role: user.role });
}

export default createHandler({ POST: postHandler });
