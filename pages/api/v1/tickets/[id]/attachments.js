import { createHandler, readRawBody, requireUser } from "infra/controller.js";
import ticket, { MAX_ATTACHMENT_BYTES } from "models/ticket.js";

// O arquivo é enviado como corpo bruto da requisição (fetch com body=File),
// com o nome no cabeçalho X-Filename. Isso evita uma dependência de
// parsing multipart.
export const config = { api: { bodyParser: false } };

async function postHandler(request, response) {
  const uploader = await requireUser(request);
  const mimeType = (request.headers["content-type"] || "").split(";")[0].trim();
  const buffer = await readRawBody(request, MAX_ATTACHMENT_BYTES);
  const created = await ticket.addAttachment(request.query.id, uploader, {
    filename: request.headers["x-filename"],
    mimeType,
    buffer,
  });
  response.status(201).json(created);
}

export default createHandler({ POST: postHandler });
