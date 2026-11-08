import database from "../database.js";
import { runPendingMigrations } from "../migrator.js";

try {
  const executed = await runPendingMigrations();
  if (executed.length === 0) {
    console.log("✓ Banco de dados atualizado (nenhuma migration pendente).");
  } else {
    executed.forEach((name) => console.log(`✓ Migration aplicada: ${name}`));
  }
} catch (error) {
  console.error("✗ Erro ao aplicar migrations:", error.message);
  process.exitCode = 1;
} finally {
  await database.end();
}
