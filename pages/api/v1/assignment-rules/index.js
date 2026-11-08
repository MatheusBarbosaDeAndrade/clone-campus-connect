import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import assignmentRule from "models/assignment-rule.js";

async function getHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  response.status(200).json(await assignmentRule.list());
}

async function postHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const created = await assignmentRule.create(getJsonBody(request));
  response.status(201).json(created);
}

export default createHandler({ GET: getHandler, POST: postHandler });
