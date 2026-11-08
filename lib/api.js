// Cliente HTTP usado pelas páginas para chamar a API.
export class ApiError extends Error {
  constructor(data, status) {
    super(data?.message || "Não foi possível concluir a operação.");
    this.status = status;
    this.field = data?.field;
    this.action = data?.action;
  }
}

export async function apiRequest(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({ message: "Falha de conexão com o servidor." }, 0);
  }
  const isJson = (response.headers.get("content-type") || "").includes(
    "application/json",
  );
  const data = isJson ? await response.json() : null;
  if (!response.ok) throw new ApiError(data, response.status);
  return data;
}

export async function uploadFile(url, file) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": encodeURIComponent(file.name),
      },
      body: file,
    });
  } catch {
    throw new ApiError({ message: "Falha de conexão ao enviar o arquivo." }, 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data, response.status);
  return data;
}

// Aceita apenas caminhos internos no parâmetro ?next= (evita open redirect).
export function safeNextPath(value, fallback) {
  if (typeof value !== "string") return fallback;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return fallback;
  }
  return value;
}
