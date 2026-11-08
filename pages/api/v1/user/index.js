import {
  clearSessionCookie,
  createHandler,
  getJsonBody,
  requireUser,
  SESSION_COOKIE,
} from "infra/controller.js";
import { ValidationError } from "infra/errors.js";
import account from "models/account.js";
import rateLimit from "models/rate-limit.js";
import session from "models/session.js";
import user from "models/user.js";

async function getHandler(request, response) {
  const current = await requireUser(request);
  response.status(200).json(await user.findById(current.id));
}

// Atualiza nome/telefone e, se informado, troca a senha (exige a atual).
async function patchHandler(request, response) {
  const current = await requireUser(request);
  const body = getJsonBody(request);

  if (body.newPassword) {
    await rateLimit.check("password-change:user", current.id);
    try {
      await user.changePassword(current.id, {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
    } catch (error) {
      if (
        error instanceof ValidationError &&
        error.field === "currentPassword"
      ) {
        await rateLimit.hit("password-change:user", current.id);
      }
      throw error;
    }
    await rateLimit.reset("password-change:user", current.id);
    // Encerra as sessões abertas em outros dispositivos (se alguém tinha
    // acesso à conta, perde o acesso); a sessão atual continua válida.
    await session.destroyOthersForUser(
      current.id,
      request.cookies?.[SESSION_COOKIE],
    );
  }
  const updated = await user.updateProfile(current.id, {
    name: body.name,
    phone: body.phone,
  });
  response.status(200).json(updated);
}

// Exclusão da conta (LGPD): exige a senha e anonimiza os dados pessoais.
async function deleteHandler(request, response) {
  const current = await requireUser(request);
  const body = getJsonBody(request);
  await rateLimit.check("password-change:user", current.id);
  try {
    await account.anonymize(current.id, {
      currentPassword: body.currentPassword,
    });
  } catch (error) {
    if (error instanceof ValidationError && error.field === "currentPassword") {
      await rateLimit.hit("password-change:user", current.id);
    }
    throw error;
  }
  clearSessionCookie(response);
  response.status(200).json({ message: "Conta excluída." });
}

export default createHandler({
  GET: getHandler,
  PATCH: patchHandler,
  DELETE: deleteHandler,
});
