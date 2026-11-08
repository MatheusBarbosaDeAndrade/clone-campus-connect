import database from "../infra/database.js";
import { NotFoundError, ValidationError } from "../infra/errors.js";
import password from "./password.js";
import {
  normalizeEmail,
  normalizePhone,
  requireOneOf,
  requireText,
  validatePassword,
} from "./validation.js";

export const ROLES = ["user", "agent", "manager"];

const PUBLIC_COLUMNS = `
  id, name, email, phone, role, is_active, last_seen_at, created_at, updated_at
`;

async function assertEmailAvailable(email, exceptId = null) {
  const result = await database.query(
    "SELECT id FROM users WHERE lower(email) = $1 AND ($2::uuid IS NULL OR id <> $2);",
    [email, exceptId],
  );
  if (result.rowCount > 0) {
    throw new ValidationError({
      field: "email",
      message: "Este email já está cadastrado.",
      action: "Use outro email ou recupere o acesso à conta existente.",
    });
  }
}

async function assertPhoneAvailable(phone, exceptId = null) {
  if (!phone) return;
  const result = await database.query(
    "SELECT id FROM users WHERE phone = $1 AND ($2::uuid IS NULL OR id <> $2);",
    [phone, exceptId],
  );
  if (result.rowCount > 0) {
    throw new ValidationError({
      field: "phone",
      message: "Este telefone já está cadastrado.",
    });
  }
}

async function create(input) {
  const name = requireText(input.name, {
    field: "name",
    label: "O nome",
    min: 3,
    max: 120,
  });
  const phone = normalizePhone(input.phone, { required: input.phoneRequired });
  const email = normalizeEmail(input.email);
  validatePassword(input.password);
  const role = requireOneOf(input.role || "user", ROLES, {
    field: "role",
    label: "Papel",
  });

  await assertEmailAvailable(email);
  await assertPhoneAvailable(phone);

  const passwordHash = await password.hash(input.password);
  const result = await database.query(
    `INSERT INTO users
       (name, email, phone, password_hash, role, privacy_accepted_at, privacy_version)
     VALUES ($1, $2, $3, $4, $5,
       CASE WHEN $6::varchar IS NULL THEN NULL ELSE now() END, $6)
     RETURNING ${PUBLIC_COLUMNS};`,
    [name, email, phone, passwordHash, role, input.privacyVersion ?? null],
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await database.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1;`,
    [id],
  );
  if (result.rowCount === 0) {
    throw new NotFoundError({ message: "Usuário não encontrado." });
  }
  return result.rows[0];
}

// Busca por email ou telefone (usado no login). Retorna o hash da senha,
// portanto só deve ser usado internamente.
async function findForLogin(login) {
  if (typeof login !== "string" || login.trim() === "") return null;
  const value = login.trim();
  if (value.includes("@")) {
    const result = await database.query(
      "SELECT * FROM users WHERE lower(email) = lower($1);",
      [value],
    );
    return result.rows[0] || null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const result = await database.query("SELECT * FROM users WHERE phone = $1;", [
    digits,
  ]);
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await database.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE lower(email) = lower($1);`,
    [email],
  );
  return result.rows[0] || null;
}

async function updateProfile(id, input) {
  const current = await findById(id);
  const name =
    input.name === undefined
      ? current.name
      : requireText(input.name, {
          field: "name",
          label: "O nome",
          min: 3,
          max: 120,
        });
  const phone =
    input.phone === undefined ? current.phone : normalizePhone(input.phone);
  await assertPhoneAvailable(phone, id);

  const result = await database.query(
    `UPDATE users SET name = $2, phone = $3, updated_at = now()
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS};`,
    [id, name, phone],
  );
  return result.rows[0];
}

async function changePassword(id, { currentPassword, newPassword }) {
  const result = await database.query(
    "SELECT password_hash FROM users WHERE id = $1;",
    [id],
  );
  if (result.rowCount === 0) throw new NotFoundError();
  const matches = await password.compare(
    currentPassword,
    result.rows[0].password_hash,
  );
  if (!matches) {
    throw new ValidationError({
      field: "currentPassword",
      message: "A senha atual está incorreta.",
    });
  }
  validatePassword(newPassword, { field: "newPassword" });
  await setPassword(id, newPassword);
}

async function setPassword(id, newPassword, client = database) {
  validatePassword(newPassword);
  const passwordHash = await password.hash(newPassword);
  await client.query(
    "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1;",
    [id, passwordHash],
  );
}

async function listStaff({ includeInactive = false } = {}) {
  const result = await database.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users
     WHERE role IN ('agent', 'manager') AND ($1 OR is_active)
     ORDER BY name;`,
    [includeInactive],
  );
  return result.rows;
}

async function listManagerIds(client = database) {
  const result = await client.query(
    "SELECT id FROM users WHERE role = 'manager' AND is_active;",
  );
  return result.rows.map((row) => row.id);
}

async function updateStaffMember(id, { role, isActive }, actor) {
  const target = await findById(id);
  if (target.role === "user") {
    throw new ValidationError({
      message: "Este usuário não faz parte da equipe.",
    });
  }
  if (id === actor.id) {
    throw new ValidationError({
      message: "Você não pode alterar o seu próprio acesso.",
      action: "Peça a outro gestor para fazer essa alteração.",
    });
  }
  const newRole =
    role === undefined
      ? target.role
      : requireOneOf(role, ["agent", "manager"], {
          field: "role",
          label: "Papel",
        });
  const newActive =
    isActive === undefined ? target.is_active : Boolean(isActive);

  return database.transaction(async (client) => {
    const result = await client.query(
      `UPDATE users SET role = $2, is_active = $3, updated_at = now()
       WHERE id = $1 RETURNING ${PUBLIC_COLUMNS};`,
      [id, newRole, newActive],
    );
    if (!newActive) {
      // Ao desativar: encerra sessões e devolve os chamados para a fila.
      await client.query("DELETE FROM sessions WHERE user_id = $1;", [id]);
      await client.query(
        `UPDATE tickets SET assignee_id = NULL, updated_at = now()
         WHERE assignee_id = $1 AND status <> 'fechado';`,
        [id],
      );
      await client.query(
        "UPDATE assignment_rules SET is_active = false WHERE agent_id = $1;",
        [id],
      );
    }
    return result.rows[0];
  });
}

const user = {
  create,
  findById,
  findForLogin,
  findByEmail,
  updateProfile,
  changePassword,
  setPassword,
  listStaff,
  listManagerIds,
  updateStaffMember,
};

export default user;
