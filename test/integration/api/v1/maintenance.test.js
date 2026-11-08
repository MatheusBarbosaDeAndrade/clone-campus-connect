import database from "infra/database.js";
import orchestrator from "test/orchestrator.js";

beforeAll(() => orchestrator.resetDatabase());
afterAll(() => orchestrator.end());

const PATH = "/api/v1/maintenance/cleanup";

describe("Limpeza via cron (GET /api/v1/maintenance/cleanup)", () => {
  test("sem o segredo correto, a rota responde 404", async () => {
    const manager = await orchestrator.createUserAndLogin({ role: "manager" });
    for (const headers of [
      {},
      { Authorization: "Bearer segredo-errado-123456" },
    ]) {
      const { status } = await orchestrator.api("GET", PATH, {
        headers,
        cookie: manager.cookie,
      });
      expect(status).toBe(404);
    }
  });

  test("com o segredo, remove sessões vencidas e mantém as válidas", async () => {
    const account = await orchestrator.createUserAndLogin();
    await database.query(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES (repeat('a', 64), $1, now() - interval '1 minute');`,
      [account.id],
    );
    const { status, data } = await orchestrator.api("GET", PATH, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(status).toBe(200);
    expect(data.removed.sessions).toBe(1);

    const still = await orchestrator.api("GET", "/api/v1/user", {
      cookie: account.cookie,
    });
    expect(still.status).toBe(200);
  });
});
