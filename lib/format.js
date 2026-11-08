// Formatação de datas/durações. O fuso é fixo para que servidor e navegador
// gerem o mesmo texto (evita divergência de hidratação no React).
export const TIMEZONE = "America/Sao_Paulo";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayKey(date) {
  return dayKeyFormatter.format(date);
}

function cleanMonth(text) {
  // "15 de jan. de 2026" -> "15 Jan 2026"
  return text
    .replace(/ de /g, " ")
    .replace(".", "")
    .replace(/ (\p{L})/u, (match, letter) => ` ${letter.toUpperCase()}`);
}

export function formatDate(value) {
  if (!value) return "";
  return cleanMonth(dateFormatter.format(new Date(value)));
}

export function formatTime(value) {
  if (!value) return "";
  return timeFormatter.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "";
  return `${formatDate(value)}, ${formatTime(value)}`;
}

// "Hoje, 14:20" / "Ontem, 09:15" / "15 Jan 2026"
export function formatDayAndTime(value, now) {
  if (!value) return "";
  const date = new Date(value);
  const reference = new Date(now);
  const yesterday = new Date(reference.getTime() - 24 * 60 * 60 * 1000);
  if (dayKey(date) === dayKey(reference)) return `Hoje, ${formatTime(date)}`;
  if (dayKey(date) === dayKey(yesterday)) return `Ontem, ${formatTime(date)}`;
  return formatDate(date);
}

// "agora", "10 min atrás", "1 hora atrás", "Ontem", "3 dias atrás"...
export function formatRelative(value, now) {
  if (!value) return "";
  const diffMs = new Date(now) - new Date(value);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hora" : "horas"} atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ontem";
  if (days < 7) return `${days} dias atrás`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? "semana" : "semanas"} atrás`;
  return formatDate(value);
}

// Duração em segundos -> "4h 23min", "45min", "2d 3h"
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "—";
  }
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}min`;
  return `${minutes}min`;
}

// Tempo restante até o prazo de SLA (negativo = vencido).
export function slaRemaining(dueAt, now) {
  const diffSeconds = (new Date(dueAt) - new Date(now)) / 1000;
  return {
    seconds: diffSeconds,
    overdue: diffSeconds < 0,
    label:
      diffSeconds < 0
        ? `Vencido há ${formatDuration(-diffSeconds)}`
        : formatDuration(diffSeconds),
  };
}

export function formatPhone(digits) {
  if (!digits) return "";
  const d = String(digits);
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

// Máscara enquanto o usuário digita.
export function maskPhone(value) {
  const d = String(value).replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function firstAndLastName(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
}
