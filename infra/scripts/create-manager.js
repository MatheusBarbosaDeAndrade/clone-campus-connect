// Cria o primeiro gestor (ou outro gestor) em qualquer ambiente, inclusive
// produção, sem senhas fixas no código.
// Uso:
//   MANAGER_NAME="Fulano" MANAGER_EMAIL="fulano@faculdade.edu.br" \
//   MANAGER_PASSWORD="uma-senha-forte" npm run manager:create
// Em produção, as variáveis do banco vêm do ambiente (ou de --env-file).
import database from "../database.js";
import user from "../../models/user.js";

const MIN_PASSWORD_LENGTH = 12;

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Defina a variável de ambiente ${name}.`);
  }
  return value;
}

try {
  const name = required("MANAGER_NAME");
  const email = required("MANAGER_EMAIL");
  const password = required("MANAGER_PASSWORD");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `A senha do gestor deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  const created = await user.create({
    name,
    email,
    phone: process.env.MANAGER_PHONE,
    password,
    role: "manager",
  });
  console.log(`✓ Gestor criado: ${created.name} <${created.email}>`);
  console.log(
    "  Remova MANAGER_PASSWORD do ambiente/histórico do terminal após o uso.",
  );
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.end();
}
