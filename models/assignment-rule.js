import database from "../infra/database.js";
import { NotFoundError, ValidationError } from "../infra/errors.js";
import category from "./category.js";
import settings from "./settings.js";
import { isUuid, requireText } from "./validation.js";

async function list() {
  const result = await database.query(`
    SELECT r.id, r.name, r.is_active, r.category_id, c.name AS category_name,
           r.agent_id, u.name AS agent_name
    FROM assignment_rules r
    JOIN categories c ON c.id = r.category_id
    JOIN users u ON u.id = r.agent_id
    WHERE c.is_active
    ORDER BY r.created_at;
  `);
  return result.rows;
}

async function assertAgent(agentId) {
  if (!isUuid(agentId)) {
    throw new ValidationError({
      field: "agentId",
      message: "Selecione um agente responsável.",
    });
  }
  const result = await database.query(
    "SELECT id FROM users WHERE id = $1 AND role IN ('agent', 'manager') AND is_active;",
    [agentId],
  );
  if (result.rowCount === 0) {
    throw new ValidationError({
      field: "agentId",
      message: "O agente selecionado não é válido.",
    });
  }
}

async function validate(input) {
  const name = requireText(input.name, {
    field: "name",
    label: "O nome da regra",
    min: 3,
    max: 80,
  });
  await category.findActiveById(Number(input.categoryId));
  await assertAgent(input.agentId);
  return { name, categoryId: Number(input.categoryId), agentId: input.agentId };
}

async function create(input) {
  const data = await validate(input);
  const result = await database.query(
    `INSERT INTO assignment_rules (name, category_id, agent_id)
     VALUES ($1, $2, $3) RETURNING id;`,
    [data.name, data.categoryId, data.agentId],
  );
  return result.rows[0];
}

async function update(id, input) {
  const currentResult = await database.query(
    "SELECT * FROM assignment_rules WHERE id = $1;",
    [id],
  );
  const current = currentResult.rows[0];
  if (!current) throw new NotFoundError({ message: "Regra não encontrada." });

  const merged = {
    name: input.name ?? current.name,
    categoryId: input.categoryId ?? current.category_id,
    agentId: input.agentId ?? current.agent_id,
  };
  const data = await validate(merged);
  const isActive =
    input.isActive === undefined ? current.is_active : Boolean(input.isActive);

  await database.query(
    `UPDATE assignment_rules SET name = $2, category_id = $3, agent_id = $4, is_active = $5
     WHERE id = $1;`,
    [id, data.name, data.categoryId, data.agentId, isActive],
  );
}

async function remove(id) {
  const result = await database.query(
    "DELETE FROM assignment_rules WHERE id = $1;",
    [id],
  );
  if (result.rowCount === 0)
    throw new NotFoundError({ message: "Regra não encontrada." });
}

// Retorna o agente que deve receber um novo chamado da categoria, ou null.
// A regra mais antiga ativa para a categoria tem precedência.
async function findAgentForCategory(categoryId, client = database) {
  const enabled = await settings.get("auto_assign_enabled", client);
  if (enabled !== true) return null;
  const result = await client.query(
    `SELECT r.agent_id FROM assignment_rules r
     JOIN users u ON u.id = r.agent_id
     WHERE r.category_id = $1 AND r.is_active AND u.is_active
       AND u.role IN ('agent', 'manager')
     ORDER BY r.created_at LIMIT 1;`,
    [categoryId],
  );
  return result.rows[0]?.agent_id ?? null;
}

const assignmentRule = { list, create, update, remove, findAgentForCategory };

export default assignmentRule;
