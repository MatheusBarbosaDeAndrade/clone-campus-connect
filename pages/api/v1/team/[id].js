import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import { NotFoundError } from "infra/errors.js";
import user from "models/user.js";
import { isUuid } from "models/validation.js";

// Altera o papel (agent/manager) ou ativa/desativa um membro da equipe.
async function patchHandler(request, response) {
  const actor = await requireUser(request, { roles: ["manager"] });
  if (!isUuid(request.query.id)) throw new NotFoundError();
  const body = getJsonBody(request);
  const updated = await user.updateStaffMember(
    request.query.id,
    { role: body.role, isActive: body.isActive },
    actor,
  );
  response.status(200).json(updated);
}

export default createHandler({ PATCH: patchHandler });
