import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import ticket, { isStaff } from "models/ticket.js";

async function getHandler(request, response) {
  const viewer = await requireUser(request);
  const details = await ticket.findForViewer(request.query.id, viewer);
  response.status(200).json(details);
}

// Equipe: altera status, prioridade e responsável.
// Solicitante: pode apenas fechar ("fechado") ou reabrir ("reaberto").
async function patchHandler(request, response) {
  const viewer = await requireUser(request);
  const body = getJsonBody(request);

  if (isStaff(viewer)) {
    await ticket.updateByStaff(request.query.id, viewer, {
      status: body.status,
      priority: body.priority,
      assigneeId: body.assigneeId,
    });
  } else {
    await ticket.updateStatusByRequester(request.query.id, viewer, body.status);
  }
  const details = await ticket.findForViewer(request.query.id, viewer);
  response.status(200).json(details.ticket);
}

export default createHandler({ GET: getHandler, PATCH: patchHandler });
