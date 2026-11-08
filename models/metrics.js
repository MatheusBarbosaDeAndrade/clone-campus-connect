import database from "../infra/database.js";
import { SLA_RISK_THRESHOLD_MINUTES } from "../lib/ticket-labels.js";

// Todas as métricas são calculadas a partir dos dados reais de chamados.

function timezone() {
  return process.env.APP_TIMEZONE || "America/Sao_Paulo";
}

async function slaOverview() {
  const summary = await database.query(`
    SELECT
      count(*) FILTER (WHERE status = 'fechado' AND closed_at <= sla_due_at)::int AS on_time,
      count(*) FILTER (
        WHERE (status = 'fechado' AND closed_at > sla_due_at)
           OR (status <> 'fechado' AND sla_due_at < now())
      )::int AS violated,
      count(*) FILTER (
        WHERE status <> 'fechado'
          AND sla_due_at < now() + interval '${SLA_RISK_THRESHOLD_MINUTES} minutes'
      )::int AS at_risk,
      EXTRACT(EPOCH FROM avg(closed_at - created_at) FILTER (WHERE status = 'fechado'))::float
        AS avg_resolution_seconds
    FROM tickets;
  `);
  const row = summary.rows[0];
  const measured = row.on_time + row.violated;
  return {
    compliance_percent:
      measured > 0 ? Math.round((row.on_time / measured) * 100) : null,
    on_time: row.on_time,
    violated: row.violated,
    at_risk: row.at_risk,
    avg_resolution_seconds: row.avg_resolution_seconds,
  };
}

async function recentEscalations({ limit = 8 } = {}) {
  const result = await database.query(
    `SELECT e.id, e.type, e.from_value, e.to_value, e.created_at,
            e.ticket_id, t.title AS ticket_title, u.name AS actor_name,
            a.name AS assignee_name
     FROM ticket_events e
     JOIN tickets t ON t.id = e.ticket_id
     LEFT JOIN users u ON u.id = e.actor_id
     LEFT JOIN users a ON a.id = t.assignee_id
     WHERE e.type IN ('escalated', 'priority_changed', 'reopened')
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT $1;`,
    [limit],
  );
  return result.rows;
}

async function recentActivity({ limit = 8 } = {}) {
  const result = await database.query(
    `SELECT e.id, e.type, e.from_value, e.to_value, e.created_at,
            e.ticket_id, t.title AS ticket_title, u.name AS actor_name
     FROM ticket_events e
     JOIN tickets t ON t.id = e.ticket_id
     LEFT JOIN users u ON u.id = e.actor_id
     WHERE NOT e.is_internal
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT $1;`,
    [limit],
  );
  return result.rows;
}

async function openByCategory() {
  const result = await database.query(`
    SELECT c.id, c.name, count(t.id)::int AS total
    FROM categories c
    LEFT JOIN tickets t ON t.category_id = c.id AND t.status <> 'fechado'
    WHERE c.is_active
    GROUP BY c.id, c.name
    ORDER BY total DESC, c.name;
  `);
  return result.rows;
}

async function openByPriority() {
  const result = await database.query(`
    SELECT priority, count(*)::int AS total
    FROM tickets WHERE status <> 'fechado'
    GROUP BY priority;
  `);
  return Object.fromEntries(
    result.rows.map((row) => [row.priority, row.total]),
  );
}

async function team() {
  const members = await database.query(`
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.last_seen_at,
      count(t.id) FILTER (WHERE t.status <> 'fechado')::int AS active,
      count(t.id)::int AS total,
      count(t.id) FILTER (WHERE t.priority = 'critica')::int AS critica,
      count(t.id) FILTER (WHERE t.priority = 'alta')::int AS alta,
      count(t.id) FILTER (WHERE t.priority = 'media')::int AS media,
      count(t.id) FILTER (WHERE t.priority = 'baixa')::int AS baixa,
      EXTRACT(EPOCH FROM avg(t.closed_at - t.created_at) FILTER (WHERE t.status = 'fechado'))::float
        AS avg_resolution_seconds
    FROM users u
    LEFT JOIN tickets t ON t.assignee_id = u.id
    WHERE u.role IN ('agent', 'manager')
    GROUP BY u.id
    ORDER BY u.is_active DESC, u.name;
  `);

  const weekly = await database.query(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, count(t.id)::int AS total
     FROM generate_series(
       (now() AT TIME ZONE $1)::date - 6,
       (now() AT TIME ZONE $1)::date,
       interval '1 day'
     ) AS d(day)
     LEFT JOIN tickets t
       ON t.status = 'fechado' AND (t.closed_at AT TIME ZONE $1)::date = d.day::date
     GROUP BY d.day
     ORDER BY d.day;`,
    [timezone()],
  );

  const quality = await database.query(`
    SELECT
      EXTRACT(EPOCH FROM avg(first_response_at - created_at))::float AS avg_first_response_seconds,
      (SELECT count(DISTINCT ticket_id) FROM ticket_events WHERE type = 'reopened')::int AS reopened,
      (SELECT count(DISTINCT ticket_id) FROM ticket_events WHERE type = 'closed')::int AS closed_ever
    FROM tickets;
  `);
  const q = quality.rows[0];

  return {
    members: members.rows,
    weekly: weekly.rows,
    avg_first_response_seconds: q.avg_first_response_seconds,
    reopen_rate_percent:
      q.closed_ever > 0
        ? Math.round((q.reopened / q.closed_ever) * 1000) / 10
        : null,
  };
}

const metrics = {
  slaOverview,
  recentEscalations,
  recentActivity,
  openByCategory,
  openByPriority,
  team,
};

export default metrics;
