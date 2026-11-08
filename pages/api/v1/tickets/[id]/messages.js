import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import ticket from "models/ticket.js";

async function postHandler(request, response) {
  const author = await requireUser(request);
  const body = getJsonBody(request);
  const created = await ticket.addMessage(request.query.id, author, {
    body: body.body,
    internal: body.internal,
  });
  response.status(201).json(created);
}

export default createHandler({ POST: postHandler });
