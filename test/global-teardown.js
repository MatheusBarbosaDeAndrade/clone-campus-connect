module.exports = async function globalTeardown() {
  const server = globalThis.__NEXT_SERVER__;
  if (server) {
    // Encerra o grupo de processos (npx + next dev).
    process.kill(-server.pid, "SIGTERM");
  }
};
