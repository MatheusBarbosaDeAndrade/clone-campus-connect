import database from "../infra/database.js";
import { ValidationError } from "../infra/errors.js";
import { PRIORITIES } from "../lib/ticket-labels.js";

async function listPolicies() {
  const result = await database.query(
    "SELECT priority, resolution_hours FROM sla_policies;",
  );
  const byPriority = Object.fromEntries(
    result.rows.map((row) => [row.priority, row.resolution_hours]),
  );
  return PRIORITIES.slice()
    .reverse()
    .map((priority) => ({
      priority,
      resolution_hours: byPriority[priority],
    }));
}

async function getHours(priority, client = database) {
  const result = await client.query(
    "SELECT resolution_hours FROM sla_policies WHERE priority = $1;",
    [priority],
  );
  return result.rows[0].resolution_hours;
}

// Recebe { critica: 2, alta: 8, ... } e atualiza todas as prioridades.
async function updatePolicies(input) {
  const values = {};
  for (const priority of PRIORITIES) {
    const hours = Number(input?.[priority]);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      throw new ValidationError({
        field: priority,
        message:
          "Os prazos de SLA devem ser números inteiros entre 1 e 720 horas.",
      });
    }
    values[priority] = hours;
  }

  await database.transaction(async (client) => {
    for (const priority of PRIORITIES) {
      await client.query(
        "UPDATE sla_policies SET resolution_hours = $2, updated_at = now() WHERE priority = $1;",
        [priority, values[priority]],
      );
    }
    // Recalcula o prazo dos chamados ainda abertos com as novas regras.
    await client.query(`
      UPDATE tickets t
      SET sla_due_at = t.sla_started_at + make_interval(hours => p.resolution_hours)
      FROM sla_policies p
      WHERE p.priority = t.priority AND t.status <> 'fechado';
    `);
  });
  return listPolicies();
}

const sla = { listPolicies, getHours, updatePolicies };

export default sla;
