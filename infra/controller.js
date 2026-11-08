import {
  InternalServerError,
  MethodNotAllowedError,
  ForbiddenError,
  PayloadTooLargeError,
  UnauthorizedError,
  isAppError,
} from "./errors.js";
import session from "../models/session.js";

export const SESSION_COOKIE = "session_id";

function onError(error, response) {
  const appError = isAppError(error)
    ? error
    : new InternalServerError({ cause: error });

  if (appError.statusCode >= 500) {
    console.error(error);
  }
  if (appError.retryAfterSeconds) {
    response.setHeader("Retry-After", String(appError.retryAfterSeconds));
  }
  response.status(appError.statusCode).json(appError);
}

// Cria um handler de API que despacha por método HTTP e padroniza erros.
// Uso: export default createHandler({ GET: fn, POST: fn })
export function createHandler(handlers) {
  return async function handler(request, response) {
    const methodHandler = handlers[request.method];
    if (!methodHandler) {
      response.setHeader("Allow", Object.keys(handlers).join(", "));
      return onError(new MethodNotAllowedError(), response);
    }
    try {
      await methodHandler(request, response);
    } catch (error) {
      onError(error, response);
    }
  };
}

// Retorna o usuário da sessão (ou null). Funciona em API routes e em
// getServerSideProps, pois ambos expõem request.cookies.
export async function getSessionUser(request) {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  return session.findUserByToken(token);
}

// Garante que exista um usuário autenticado e, opcionalmente, que ele tenha
// um dos papéis permitidos.
export async function requireUser(request, { roles } = {}) {
  const user = await getSessionUser(request);
  if (!user) throw new UnauthorizedError();
  if (roles && !roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

// IP do cliente, usado no limite de tentativas. Atrás de um proxy reverso
// (Nginx, Render, Railway...), defina TRUST_PROXY=true: o IP real vem no
// X-Forwarded-For. Usamos o último valor, que é o adicionado pelo proxy
// confiável (os anteriores podem ser forjados pelo cliente).
export function getClientIp(request) {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = String(request.headers["x-forwarded-for"] || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (forwarded.length > 0) return forwarded[forwarded.length - 1];
  }
  return request.socket?.remoteAddress || "unknown";
}

export const STAFF_ROLES = ["agent", "manager"];

function buildCookie(value, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`);
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function setSessionCookie(
  response,
  token,
  { persistent, maxAgeSeconds },
) {
  response.setHeader(
    "Set-Cookie",
    buildCookie(token, persistent ? maxAgeSeconds : undefined),
  );
}

export function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", buildCookie("invalid", 0));
}

// Lê o corpo bruto da requisição respeitando um limite de tamanho.
export async function readRawBody(request, limitBytes) {
  const declared = Number(request.headers["content-length"]);
  if (declared > limitBytes) {
    throw new PayloadTooLargeError({
      message: `O arquivo deve ter no máximo ${Math.round(limitBytes / 1024 / 1024)} MB.`,
    });
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limitBytes) {
      throw new PayloadTooLargeError({
        message: `O arquivo deve ter no máximo ${Math.round(limitBytes / 1024 / 1024)} MB.`,
      });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Exige corpo JSON nas requisições que alteram dados. Junto com o cookie
// SameSite=Lax, impede envios de formulários de outros sites (CSRF).
export function getJsonBody(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.includes("application/json")) {
    const error = new ForbiddenError({
      message: "Formato de requisição inválido.",
      action: "Envie os dados como JSON.",
    });
    throw error;
  }
  return request.body && typeof request.body === "object" ? request.body : {};
}
