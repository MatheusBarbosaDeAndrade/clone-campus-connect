import database from "../infra/database.js";

async function get(key, client = database) {
  const result = await client.query(
    "SELECT value FROM app_settings WHERE key = $1;",
    [key],
  );
  return result.rows[0]?.value ?? null;
}

async function set(key, value) {
  await database.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();`,
    [key, JSON.stringify(value)],
  );
  return value;
}

const settings = { get, set };

export default settings;
