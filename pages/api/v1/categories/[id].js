import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import category from "models/category.js";
import { parseId } from "models/validation.js";

async function patchHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const id = parseId(request.query.id, { label: "Categoria" });
  const updated = await category.rename(id, getJsonBody(request));
  response.status(200).json(updated);
}

async function deleteHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const id = parseId(request.query.id, { label: "Categoria" });
  await category.deactivate(id);
  response.status(200).json({ ok: true });
}

export default createHandler({ PATCH: patchHandler, DELETE: deleteHandler });
