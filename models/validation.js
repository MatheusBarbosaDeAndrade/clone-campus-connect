import { ValidationError } from "../infra/errors.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireText(value, { field, label, min = 1, max }) {
  if (typeof value !== "string" || value.trim().length < min) {
    throw new ValidationError({
      field,
      message:
        min > 1
          ? `${label} deve ter pelo menos ${min} caracteres.`
          : `${label} é obrigatório.`,
    });
  }
  const trimmed = value.trim();
  if (max && trimmed.length > max) {
    throw new ValidationError({
      field,
      message: `${label} deve ter no máximo ${max} caracteres.`,
    });
  }
  return trimmed;
}

export function normalizeEmail(value) {
  const email = requireText(value, {
    field: "email",
    label: "O email",
    max: 254,
  }).toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError({ field: "email", message: "Email inválido." });
  }
  return email;
}

// Telefones brasileiros: DDD + número (10 ou 11 dígitos). Armazenamos só
// os dígitos para permitir login por telefone independente da máscara.
export function normalizePhone(value, { required = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) {
      throw new ValidationError({
        field: "phone",
        message: "O telefone é obrigatório.",
      });
    }
    return null;
  }
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    throw new ValidationError({
      field: "phone",
      message: "Telefone inválido. Informe DDD e número.",
    });
  }
  return digits;
}

export function validatePassword(value, { field = "password" } = {}) {
  if (typeof value !== "string" || value.length < 8) {
    throw new ValidationError({
      field,
      message: "A senha deve ter pelo menos 8 caracteres.",
    });
  }
  if (value.length > 72) {
    throw new ValidationError({
      field,
      message: "A senha deve ter no máximo 72 caracteres.",
    });
  }
  return value;
}

export function requireOneOf(value, allowed, { field, label }) {
  if (!allowed.includes(value)) {
    throw new ValidationError({ field, message: `${label} inválido(a).` });
  }
  return value;
}

export function parseId(value, { label = "Identificador" } = {}) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    throw new ValidationError({ message: `${label} inválido.` });
  }
  return id;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}
