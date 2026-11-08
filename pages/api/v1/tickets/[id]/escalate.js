import { createHandler, requireUser, STAFF_ROLES } from "infra/controller.js";
import ticket from "models/ticket.js";

async function postHandler(request, response) {
  const actor = await requireUser(request, { roles: STAFF_ROLES });
  const result = await ticket.escalate(request.query.id, actor);
  response.status(200).json(result);
}

export default createHandler({ POST: postHandler });
