import { createHandler, getJsonBody, requireUser } from "infra/controller.js";
import category from "models/category.js";

async function getHandler(request, response) {
  await requireUser(request);
  response.status(200).json(await category.listActive());
}

async function postHandler(request, response) {
  await requireUser(request, { roles: ["manager"] });
  const created = await category.create(getJsonBody(request));
  response.status(201).json(created);
}

export default createHandler({ GET: getHandler, POST: postHandler });
