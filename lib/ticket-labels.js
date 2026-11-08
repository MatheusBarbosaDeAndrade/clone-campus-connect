// Constantes de domínio compartilhadas entre servidor e interface.
// (Este arquivo não pode importar nada do servidor.)

export const PRIORITIES = ["baixa", "media", "alta", "critica"];

export const PRIORITY_LABELS = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const STATUSES = [
  "aberto",
  "em_analise",
  "em_andamento",
  "aguardando",
  "fechado",
  "reaberto",
];

export const STATUS_LABELS = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  em_andamento: "Em Andamento",
  aguardando: "Aguardando Resposta",
  fechado: "Fechado",
  reaberto: "Reaberto",
};

export const ROLE_LABELS = {
  user: "Usuário",
  agent: "Agente",
  manager: "Gestor",
};

// Chamados "em risco" de violar o SLA: menos de 1 hora restante (ou vencidos).
export const SLA_RISK_THRESHOLD_MINUTES = 60;

export function ticketCode(id) {
  return `#${String(id).padStart(3, "0")}`;
}

export function isOpenStatus(status) {
  return status !== "fechado";
}

// Abas da fila de chamados da equipe.
export const QUEUE_TABS = ["all", "unassigned", "critical", "sla_risk"];
