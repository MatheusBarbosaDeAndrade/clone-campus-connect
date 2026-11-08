import {
  createHandler,
  getJsonBody,
  requireUser,
  STAFF_ROLES,
} from "infra/controller.js";
import user from "models/user.js";

async function getHandler(request, response) {
  await requireUser(request, { roles: STAFF_ROLES });
  response.status(200).json(await user.listStaff());
}

// Gestor cadastra um novo membro da equipe (agente ou gestor).
async function postHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const body = getJsonBody(request);
  const role = body.role === "manager" ? "manager" : "agent";
  const created = await user.create({
    name: body.name,
    email: body.email,
    phone: body.phone,
    password: body.password,
    role,
  });
  response.status(201).json(created);
}

export default createHandler({ GET: getHandler, POST: postHandler });
