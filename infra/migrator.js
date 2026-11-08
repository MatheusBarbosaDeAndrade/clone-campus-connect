import fs from "node:fs/promises";
import path from "node:path";
import database from "./database.js";

// Runner de migrations simples: cada arquivo .sql em infra/migrations é
// aplicado uma única vez, em ordem alfabética, dentro de uma transação.
// Os nomes aplicados ficam registrados na tabela schema_migrations.

const MIGRATIONS_DIR = path.join(process.cwd(), "infra", "migrations");
const LOCK_ID = 7270_2026;

async function listMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith(".sql")).sort();
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name varchar(255) PRIMARY KEY,
      run_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied(client) {
  const result = await client.query("SELECT name FROM schema_migrations;");
  return new Set(result.rows.map((row) => row.name));
}

export async function listPendingMigrations() {
  const client = await database.getNewClient();
  try {
    await ensureTable(client);
    const applied = await getApplied(client);
    const files = await listMigrationFiles();
    return files.filter((file) => !applied.has(file));
  } finally {
    client.release();
  }
}

export async function runPendingMigrations() {
  const client = await database.getNewClient();
  const executed = [];
  try {
    // Evita que dois processos apliquem migrations ao mesmo tempo.
    await client.query("SELECT pg_advisory_lock($1);", [LOCK_ID]);
    await ensureTable(client);
    const applied = await getApplied(client);
    const files = await listMigrationFiles();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name) VALUES ($1);",
          [file],
        );
        await client.query("COMMIT");
        executed.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        error.message = `Falha na migration ${file}: ${error.message}`;
        throw error;
      }
    }
    return executed;
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1);", [LOCK_ID])
      .catch(() => {});
    client.release();
  }
}
