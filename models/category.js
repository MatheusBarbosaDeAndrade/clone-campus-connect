import database from "../infra/database.js";
import { NotFoundError, ValidationError } from "../infra/errors.js";
import { requireText } from "./validation.js";

async function listActive() {
  const result = await database.query(
    "SELECT id, name FROM categories WHERE is_active ORDER BY name;",
  );
  return result.rows;
}

async function findActiveById(id, client = database) {
  const result = await client.query(
    "SELECT id, name FROM categories WHERE id = $1 AND is_active;",
    [id],
  );
  if (result.rowCount === 0) {
    throw new ValidationError({
      field: "categoryId",
      message: "Selecione uma categoria válida.",
    });
  }
  return result.rows[0];
}

async function assertNameAvailable(name, exceptId = null) {
  const result = await database.query(
    `SELECT id FROM categories
     WHERE is_active AND lower(name) = lower($1) AND ($2::int IS NULL OR id <> $2);`,
    [name, exceptId],
  );
  if (result.rowCount > 0) {
    throw new ValidationError({
      field: "name",
      message: "Já existe uma categoria com esse nome.",
    });
  }
}

function validateName(value) {
  return requireText(value, {
    field: "name",
    label: "O nome da categoria",
    min: 2,
    max: 60,
  });
}

async function create(input) {
  const name = validateName(input.name);
  await assertNameAvailable(name);
  const result = await database.query(
    "INSERT INTO categories (name) VALUES ($1) RETURNING id, name;",
    [name],
  );
  return result.rows[0];
}

async function rename(id, input) {
  const name = validateName(input.name);
  await assertNameAvailable(name, id);
  const result = await database.query(
    "UPDATE categories SET name = $2 WHERE id = $1 AND is_active RETURNING id, name;",
    [id, name],
  );
  if (result.rowCount === 0) throw new NotFoundError();
  return result.rows[0];
}

// Exclusão lógica: chamados antigos continuam apontando para a categoria,
// mas ela deixa de aparecer para novos chamados.
async function deactivate(id) {
  return database.transaction(async (client) => {
    const result = await client.query(
      "UPDATE categories SET is_active = false WHERE id = $1 AND is_active RETURNING id;",
      [id],
    );
    if (result.rowCount === 0) throw new NotFoundError();
    await client.query(
      "UPDATE assignment_rules SET is_active = false WHERE category_id = $1;",
      [id],
    );
  });
}

const category = { listActive, findActiveById, create, rename, deactivate };

export default category;
