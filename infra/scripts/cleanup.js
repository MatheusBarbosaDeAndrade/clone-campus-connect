// Limpeza periódica (ver models/maintenance.js). Agende para rodar
// diariamente (na stack Docker, o serviço `cleanup` já faz isso).
import database from "../database.js";
import maintenance from "../../models/maintenance.js";

try {
  const removed = await maintenance.cleanup();
  console.log(
    `✓ Limpeza concluída: ${removed.sessions} sessões, ${removed.passwordResetTokens} tokens de recuperação, ${removed.loginCodes} códigos de acesso, ${removed.rateLimitHits} registros de tentativas.`,
  );
} catch (error) {
  console.error("✗ Erro na limpeza:", error.message);
  process.exitCode = 1;
} finally {
  await database.end();
}
