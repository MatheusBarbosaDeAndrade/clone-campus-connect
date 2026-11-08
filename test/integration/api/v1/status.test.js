import orchestrator from "test/orchestrator.js";

beforeAll(() => orchestrator.resetDatabase());
afterAll(() => orchestrator.end());

describe("GET /api/v1/status", () => {
  test("público: informa só que o banco está saudável", async () => {
    const { status, data } = await orchestrator.api("GET", "/api/v1/status");
    expect(status).toBe(200);
    expect(new Date(data.updated_at).toISOString()).toBe(data.updated_at);
    expect(data.dependencies.database).toEqual({ status: "healthy" });
  });

  test("usuário comum e agente também não veem detalhes do banco", async () => {
    for (const role of ["user", "agent"]) {
      const account = await orchestrator.createUserAndLogin({ role });
      const { data } = await orchestrator.api("GET", "/api/v1/status", {
        cookie: account.cookie,
      });
      expect(data.dependencies.database).toEqual({ status: "healthy" });
    }
  });

  test("gestor vê versão e conexões do banco", async () => {
    const manager = await orchestrator.createUserAndLogin({ role: "manager" });
    const { status, data } = await orchestrator.api("GET", "/api/v1/status", {
      cookie: manager.cookie,
    });
    expect(status).toBe(200);
    expect(data.dependencies.database.status).toBe("healthy");
    expect(data.dependencies.database.version).toMatch(/^18\./);
    expect(data.dependencies.database.max_connections).toBeGreaterThan(0);
    expect(data.dependencies.database.opened_connections).toBeGreaterThan(0);
  });

  test("rejeita métodos não permitidos", async () => {
    const { status, data } = await orchestrator.api("POST", "/api/v1/status");
    expect(status).toBe(405);
    expect(data.name).toBe("MethodNotAllowedError");
  });
});
