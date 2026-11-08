import { createHandler, getClientIp, getJsonBody } from "infra/controller.js";
import passwordReset from "models/password-reset.js";
import rateLimit from "models/rate-limit.js";
import { normalizeEmail } from "models/validation.js";

async function postHandler(request, response) {
  const body = getJsonBody(request);
  const address = normalizeEmail(body.email);
  // Conta todo pedido, exista ou não a conta: assim o limite não revela
  // quais emails estão cadastrados.
  await rateLimit.consume("reset:ip", getClientIp(request));
  await rateLimit.consume("reset:email", address);

  await passwordReset.request(address);
  response.status(202).json({
    message:
      "Se o email estiver cadastrado, você receberá um link de recuperação.",
  });
}

async function patchHandler(request, response) {
  const body = getJsonBody(request);
  await passwordReset.reset({ token: body.token, password: body.password });
  response.status(200).json({ message: "Senha redefinida com sucesso." });
}

export default createHandler({ POST: postHandler, PATCH: patchHandler });
