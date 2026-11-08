import { createHandler, getClientIp, getJsonBody } from "infra/controller.js";
import { ValidationError } from "infra/errors.js";
import { PRIVACY_POLICY_VERSION } from "lib/privacy.js";
import rateLimit from "models/rate-limit.js";
import loginCode from "models/login-code.js";
import user from "models/user.js";

// Cadastro público: sempre cria contas com papel "user". Contas da equipe
// são criadas por gestores em /api/v1/team.
async function postHandler(request, response) {
  const body = getJsonBody(request);
  const ip = getClientIp(request);
  await rateLimit.check("signup:ip", ip);
  if (body.acceptPrivacy !== true) {
    throw new ValidationError({
      field: "acceptPrivacy",
      message:
        "É preciso aceitar a Política de Privacidade para criar a conta.",
    });
  }

  const created = await user.create({
    name: body.name,
    phone: body.phone,
    phoneRequired: true,
    email: body.email,
    password: body.password,
    role: "user",
    privacyVersion: PRIVACY_POLICY_VERSION,
  });
  await rateLimit.hit("signup:ip", ip);

  // A conta só é acessada depois de confirmar o código enviado ao e-mail
  // (o que também comprova que o e-mail informado pertence à pessoa).
  const challenge = await loginCode.start(created);
  response.status(201).json({ ...created, verification: challenge });
}

export default createHandler({ POST: postHandler });
