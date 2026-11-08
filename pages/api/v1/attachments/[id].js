import { createHandler, requireUser } from "infra/controller.js";
import ticket from "models/ticket.js";

// Anexos podem passar do limite padrão de resposta de 4 MB (ver lib/attachments.js).
export const config = { api: { responseLimit: false } };

async function getHandler(request, response) {
  const viewer = await requireUser(request);
  const attachment = await ticket.getAttachment(request.query.id, viewer);
  const disposition = attachment.mime_type.startsWith("image/")
    ? "inline"
    : "attachment";

  response.setHeader("Content-Type", attachment.mime_type);
  response.setHeader("Content-Length", attachment.size_bytes);
  response.setHeader(
    "Content-Disposition",
    `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "sandbox");
  response.setHeader("Cache-Control", "private, no-store");
  response.status(200).send(attachment.content);
}

export default createHandler({ GET: getHandler });
