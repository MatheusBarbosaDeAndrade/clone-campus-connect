class AppError extends Error {
  constructor({ name, message, action, statusCode, cause }) {
    super(message, { cause });
    this.name = name;
    this.action = action;
    this.statusCode = statusCode;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      action: this.action,
      status_code: this.statusCode,
    };
  }
}

export class ValidationError extends AppError {
  constructor({ message, action, field } = {}) {
    super({
      name: "ValidationError",
      message: message || "Os dados enviados são inválidos.",
      action: action || "Revise os dados enviados e tente novamente.",
      statusCode: 400,
    });
    this.field = field;
  }

  toJSON() {
    return { ...super.toJSON(), field: this.field };
  }
}

export class UnauthorizedError extends AppError {
  constructor({ message, action } = {}) {
    super({
      name: "UnauthorizedError",
      message: message || "Você precisa estar autenticado.",
      action: action || "Faça login para continuar.",
      statusCode: 401,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor({ message, action } = {}) {
    super({
      name: "ForbiddenError",
      message: message || "Você não tem permissão para executar esta ação.",
      action: action || "Verifique se sua conta possui o acesso necessário.",
      statusCode: 403,
    });
  }
}

export class NotFoundError extends AppError {
  constructor({ message, action } = {}) {
    super({
      name: "NotFoundError",
      message: message || "O recurso solicitado não foi encontrado.",
      action: action || "Verifique se o endereço está correto.",
      statusCode: 404,
    });
  }
}

export class MethodNotAllowedError extends AppError {
  constructor() {
    super({
      name: "MethodNotAllowedError",
      message: "Método não permitido para este endpoint.",
      action: "Verifique o método HTTP utilizado.",
      statusCode: 405,
    });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor({ message } = {}) {
    super({
      name: "PayloadTooLargeError",
      message: message || "O arquivo enviado é grande demais.",
      action: "Envie um arquivo menor.",
      statusCode: 413,
    });
  }
}

export class TooManyRequestsError extends AppError {
  constructor({ message, retryAfterSeconds } = {}) {
    super({
      name: "TooManyRequestsError",
      message: `${message || "Muitas tentativas em pouco tempo."} Aguarde ${formatWait(retryAfterSeconds)} e tente novamente.`,
      action: "Aguarde o tempo indicado antes de tentar de novo.",
      statusCode: 429,
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function formatWait(seconds) {
  if (!seconds || seconds < 60) return "alguns instantes";
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

export class ServiceError extends AppError {
  constructor({ message, cause } = {}) {
    super({
      name: "ServiceError",
      message: message || "Serviço indisponível no momento.",
      action: "Verifique se os serviços (banco de dados, e-mail) estão ativos.",
      statusCode: 503,
      cause,
    });
  }
}

export class InternalServerError extends AppError {
  constructor({ cause } = {}) {
    super({
      name: "InternalServerError",
      message: "Ocorreu um erro interno inesperado.",
      action: "Tente novamente. Se o problema persistir, contate o suporte.",
      statusCode: 500,
      cause,
    });
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
