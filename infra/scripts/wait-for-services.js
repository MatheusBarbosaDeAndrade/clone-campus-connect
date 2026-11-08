import database from "../database.js";

const TIMEOUT_MS = 60_000;
const INTERVAL_MS = 500;

async function waitForPostgres() {
  const startedAt = Date.now();
  process.stdout.write("Aguardando o Postgres aceitar conexões");
  while (Date.now() - startedAt < TIMEOUT_MS) {
    try {
      await database.query("SELECT 1;");
      console.log("\n✓ Postgres pronto.");
      return;
    } catch {
      process.stdout.write(".");
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }
  throw new Error("Tempo esgotado aguardando o Postgres.");
}

try {
  await waitForPostgres();
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.end();
}
