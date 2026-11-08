import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import { ValidationError } from "infra/errors.js";
import settings from "models/settings.js";

async function getHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  response.status(200).json({
    autoAssignEnabled: (await settings.get("auto_assign_enabled")) === true,
  });
}

async function patchHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const body = getJsonBody(request);
  if (typeof body.autoAssignEnabled !== "boolean") {
    throw new ValidationError({
      message: "Valor inválido para a atribuição automática.",
    });
  }
  await settings.set("auto_assign_enabled", body.autoAssignEnabled);
  response.status(200).json({ autoAssignEnabled: body.autoAssignEnabled });
}

export default createHandler({ GET: getHandler, PATCH: patchHandler });
