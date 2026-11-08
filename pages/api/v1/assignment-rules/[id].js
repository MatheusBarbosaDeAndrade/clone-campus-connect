import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import assignmentRule from "models/assignment-rule.js";
import { parseId } from "models/validation.js";

async function patchHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const id = parseId(request.query.id, { label: "Regra" });
  await assignmentRule.update(id, getJsonBody(request));
  response.status(200).json({ ok: true });
}

async function deleteHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const id = parseId(request.query.id, { label: "Regra" });
  await assignmentRule.remove(id);
  response.status(200).json({ ok: true });
}

export default createHandler({ PATCH: patchHandler, DELETE: deleteHandler });
