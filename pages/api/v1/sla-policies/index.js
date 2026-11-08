import {
  createHandler,
  getJsonBody,
  requireUser,
  STAFF_ROLES,
} from "infra/controller.js";
import sla from "models/sla.js";

async function getHandler(request, response) {
  await requireUser(request, { roles: STAFF_ROLES });
  response.status(200).json(await sla.listPolicies());
}

// Corpo: { critica: 2, alta: 8, media: 24, baixa: 72 } (em horas).
async function putHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const policies = await sla.updatePolicies(getJsonBody(request));
  response.status(200).json(policies);
}

export default createHandler({ GET: getHandler, PUT: putHandler });
