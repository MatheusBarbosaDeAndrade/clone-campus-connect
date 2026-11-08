import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import ticket, { isStaff } from "models/ticket.js";

// Usuário comum: lista apenas os próprios chamados.
// Equipe: lista a fila geral (com abas/filtros).
async function getHandler(request, response) {
  const viewer = await requireUser(request);
  const { search, status, sort, tab, categoryId } = request.query;

  if (isStaff(viewer)) {
    const tickets = await ticket.listQueue({ tab, categoryId, search });
    return response.status(200).json(tickets);
  }
  const tickets = await ticket.listForRequester(viewer.id, {
    search,
    status,
    sort,
  });
  response.status(200).json(tickets);
}

async function postHandler(request, response) {
  const requester = await requireUser(request);
  const body = getJsonBody(request);
  const created = await ticket.create(requester, body);
  response.status(201).json(created);
}

export default createHandler({ GET: getHandler, POST: postHandler });
