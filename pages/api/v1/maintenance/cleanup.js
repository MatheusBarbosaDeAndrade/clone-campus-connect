import crypto from "node:crypto";
import { createHandler } from "infra/controller.js";
import { NotFoundError } from "infra/errors.js";
import maintenance from "models/maintenance.js";

// Chamada pelo Cron da Vercel (vercel.json), que envia
// "Authorization: Bearer <CRON_SECRET>". Sem CRON_SECRET configurado, ou com
// o segredo errado, a rota responde 404 como se não existisse.
function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(String(request.headers.authorization || ""));
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
}

async function getHandler(request, response) {
  if (!isAuthorized(request)) throw new NotFoundError();
  response.status(200).json({ ok: true, removed: await maintenance.cleanup() });
}

export default createHandler({ GET: getHandler });
