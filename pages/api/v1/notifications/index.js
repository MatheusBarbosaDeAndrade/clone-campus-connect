import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import notification from "models/notification.js";

async function getHandler(request, response) {
  const viewer = await requireUser(request);
  const [items, unread] = await Promise.all([
    notification.listForUser(viewer.id),
    notification.countUnread(viewer.id),
  ]);
  response.status(200).json({ unread, items });
}

// Marca todas como lidas ({ all: true }) ou uma específica ({ id }).
async function patchHandler(request, response) {
  const viewer = await requireUser(request);
  const body = getJsonBody(request);
  if (body.all === true) {
    await notification.markAllRead(viewer.id);
    return response.status(200).json({ ok: true });
  }
  const updated = await notification.markRead(Number(body.id), viewer.id);
  response.status(200).json(updated);
}

export default createHandler({ GET: getHandler, PATCH: patchHandler });
