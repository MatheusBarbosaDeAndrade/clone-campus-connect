import { createHandler, requireUser } from "infra/controller.js";
import account from "models/account.js";

// Exportação dos dados pessoais do usuário (LGPD, art. 18, II e V).
async function getHandler(request, response) {
  const current = await requireUser(request);
  const data = await account.exportData(current.id);
  const date = data.exported_at.slice(0, 10);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="meus-dados-campusconnect-${date}.json"`,
  );
  response.status(200).json(data);
}

export default createHandler({ GET: getHandler });
