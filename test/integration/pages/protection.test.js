import orchestrator from "test/orchestrator.js";

let user;
let otherUser;
let agent;
let manager;
let ownTicketId;

beforeAll(async () => {
  await orchestrator.resetDatabase();
  user = await orchestrator.createUserAndLogin();
  otherUser = await orchestrator.createUserAndLogin();
  agent = await orchestrator.createUserAndLogin({ role: "agent" });
  manager = await orchestrator.createUserAndLogin({ role: "manager" });
  const categories = await orchestrator.api("GET", "/api/v1/categories", {
    cookie: user.cookie,
  });
  const created = await orchestrator.api("POST", "/api/v1/tickets", {
    cookie: user.cookie,
    body: {
      title: "Chamado para teste de páginas",
      description: "Descrição suficientemente longa para o teste.",
      categoryId: categories.data[0].id,
      priority: "media",
    },
  });
  ownTicketId = created.data.id;
});
afterAll(() => orchestrator.end());

const page = (path, cookie) => orchestrator.api("GET", path, { cookie });

describe("Páginas públicas", () => {
  test.each(["/", "/login", "/cadastro", "/recuperar-senha", "/gestor/login"])(
    "%s carrega sem sessão",
    async (path) => {
      const { status, data } = await page(path);
      expect(status).toBe(200);
      expect(data).toContain("CampusConnect");
    },
  );

  test("usuário autenticado é redirecionado do login para o início", async () => {
    const { status, headers } = await page("/login", user.cookie);
    expect(status).toBe(307);
    expect(headers.get("location")).toBe("/inicio");
  });

  test("rota inexistente retorna 404 personalizado", async () => {
    const { status, data } = await page("/nao-existe");
    expect(status).toBe(404);
    expect(data).toContain("Página não encontrada");
  });
});

describe("Área do usuário", () => {
  test.each([
    "/inicio",
    "/chamados",
    "/chamados/novo",
    "/notificacoes",
    "/perfil",
  ])("%s exige login e funciona para o usuário", async (path) => {
    const anonymous = await page(path);
    expect(anonymous.status).toBe(307);
    expect(anonymous.headers.get("location")).toMatch(/^\/login\?next=/);

    const logged = await page(path, user.cookie);
    expect(logged.status).toBe(200);
  });

  test("detalhe do chamado: dono vê, outro usuário recebe 404", async () => {
    expect((await page(`/chamados/${ownTicketId}`, user.cookie)).status).toBe(
      200,
    );
    expect(
      (await page(`/chamados/${ownTicketId}`, otherUser.cookie)).status,
    ).toBe(404);
  });

  test("equipe é redirecionada para o console", async () => {
    const { status, headers } = await page("/inicio", agent.cookie);
    expect(status).toBe(307);
    expect(headers.get("location")).toBe("/gestor");
  });
});

describe("Console de gestão", () => {
  test.each([
    "/gestor",
    "/gestor/fila",
    "/gestor/sla",
    "/gestor/equipe",
    "/gestor/notificacoes",
    "/gestor/perfil",
  ])("%s: agente acessa, usuário comum não", async (path) => {
    const anonymous = await page(path);
    expect(anonymous.headers.get("location")).toMatch(
      /^\/gestor\/login\?next=/,
    );
    expect((await page(path, agent.cookie)).status).toBe(200);
    const asUser = await page(path, user.cookie);
    expect(asUser.status).toBe(307);
    expect(asUser.headers.get("location")).toBe("/inicio");
  });

  test("detalhe do chamado no console", async () => {
    expect(
      (await page(`/gestor/chamados/${ownTicketId}`, agent.cookie)).status,
    ).toBe(200);
    expect((await page("/gestor/chamados/99999", agent.cookie)).status).toBe(
      404,
    );
  });

  test("configurações são exclusivas do gestor", async () => {
    expect((await page("/gestor/configuracoes", manager.cookie)).status).toBe(
      200,
    );
    const asAgent = await page("/gestor/configuracoes", agent.cookie);
    expect(asAgent.status).toBe(307);
    expect(asAgent.headers.get("location")).toBe("/gestor");
  });
});
