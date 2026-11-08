const { spawn } = require("node:child_process");

const BASE_URL = "http://localhost:3000";

async function isServerUp() {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/status`);
    return response.status === 200;
  } catch {
    return false;
  }
}

// Usa o servidor de desenvolvimento se já estiver rodando; caso contrário,
// inicia um `next dev` só para os testes (encerrado no global-teardown).
module.exports = async function globalSetup() {
  if (await isServerUp()) return;

  const server = spawn("npx", ["next", "dev"], {
    stdio: "ignore",
    detached: true,
    env: process.env,
  });
  globalThis.__NEXT_SERVER__ = server;

  for (let attempt = 0; attempt < 120; attempt++) {
    if (await isServerUp()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("O servidor Next não iniciou a tempo para os testes.");
};
