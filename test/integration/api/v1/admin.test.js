import orchestrator from "test/orchestrator.js";

let user;
let agent;
let manager;

beforeAll(async () => {
  await orchestrator.resetDatabase();
  user = await orchestrator.createUserAndLogin();
  agent = await orchestrator.createUserAndLogin({
    role: "agent",
    name: "Carlos Santos",
  });
  manager = await orchestrator.createUserAndLogin({
    role: "manager",
    name: "Ana Gestora",
  });
});
afterAll(() => orchestrator.end());

describe("Permissões administrativas", () => {
  test.each([
    ["POST", "/api/v1/categories", { name: "Nova" }],
    [
      "PUT",
      "/api/v1/sla-policies",
      { critica: 1, alta: 2, media: 3, baixa: 4 },
    ],
    ["GET", "/api/v1/assignment-rules", undefined],
    ["PATCH", "/api/v1/settings", { autoAssignEnabled: true }],
    [
      "POST",
      "/api/v1/team",
      { name: "Novo", email: "n@c.test", password: "12345678" },
    ],
  ])("%s %s é exclusivo do gestor", async (method, path, body) => {
    for (const account of [user, agent]) {
      const { status } = await orchestrator.api(method, path, {
        cookie: account.cookie,
        body,
      });
      expect(status).toBe(403);
    }
  });

  test("usuário comum não acessa a fila geral de SLA", async () => {
    const { status } = await orchestrator.api("GET", "/api/v1/sla-policies", {
      cookie: user.cookie,
    });
    expect(status).toBe(403);
  });
});

describe("Categorias", () => {
  test("cria, renomeia, impede duplicado e desativa", async () => {
    const created = await orchestrator.api("POST", "/api/v1/categories", {
      cookie: manager.cookie,
      body: { name: "Laboratórios" },
    });
    expect(created.status).toBe(201);

    const duplicate = await orchestrator.api("POST", "/api/v1/categories", {
      cookie: manager.cookie,
      body: { name: "laboratórios" },
    });
    expect(duplicate.status).toBe(400);

    const renamed = await orchestrator.api(
      "PATCH",
      `/api/v1/categories/${created.data.id}`,
      {
        cookie: manager.cookie,
        body: { name: "Laboratórios de Informática" },
      },
    );
    expect(renamed.data.name).toBe("Laboratórios de Informática");

    const removed = await orchestrator.api(
      "DELETE",
      `/api/v1/categories/${created.data.id}`,
      {
        cookie: manager.cookie,
      },
    );
    expect(removed.status).toBe(200);

    const list = await orchestrator.api("GET", "/api/v1/categories", {
      cookie: user.cookie,
    });
    expect(list.data.some((c) => c.id === created.data.id)).toBe(false);
  });
});

describe("SLA", () => {
  test("atualiza prazos e valida valores", async () => {
    const invalid = await orchestrator.api("PUT", "/api/v1/sla-policies", {
      cookie: manager.cookie,
      body: { critica: 0, alta: 8, media: 24, baixa: 72 },
    });
    expect(invalid.status).toBe(400);

    const ok = await orchestrator.api("PUT", "/api/v1/sla-policies", {
      cookie: manager.cookie,
      body: { critica: 4, alta: 8, media: 24, baixa: 72 },
    });
    expect(ok.status).toBe(200);
    expect(ok.data.find((p) => p.priority === "critica").resolution_hours).toBe(
      4,
    );
  });
});

describe("Atribuição automática", () => {
  test("novo chamado vai para o agente da regra quando ativada", async () => {
    const categories = await orchestrator.api("GET", "/api/v1/categories", {
      cookie: user.cookie,
    });
    const categoryId = categories.data.find((c) => c.name === "Biblioteca").id;

    const rule = await orchestrator.api("POST", "/api/v1/assignment-rules", {
      cookie: manager.cookie,
      body: { name: "Biblioteca", categoryId, agentId: agent.id },
    });
    expect(rule.status).toBe(201);

    const newTicket = () =>
      orchestrator.api("POST", "/api/v1/tickets", {
        cookie: user.cookie,
        body: {
          title: "Multa indevida na biblioteca",
          description:
            "Livro devolvido no prazo, mas o sistema registrou atraso.",
          categoryId,
          priority: "baixa",
        },
      });

    const beforeEnable = await newTicket();
    const t1 = await orchestrator.api(
      "GET",
      `/api/v1/tickets/${beforeEnable.data.id}`,
      {
        cookie: manager.cookie,
      },
    );
    expect(t1.data.ticket.assignee_id).toBeNull();

    await orchestrator.api("PATCH", "/api/v1/settings", {
      cookie: manager.cookie,
      body: { autoAssignEnabled: true },
    });

    const afterEnable = await newTicket();
    const t2 = await orchestrator.api(
      "GET",
      `/api/v1/tickets/${afterEnable.data.id}`,
      {
        cookie: manager.cookie,
      },
    );
    expect(t2.data.ticket.assignee_id).toBe(agent.id);

    await orchestrator.api(
      "PATCH",
      `/api/v1/assignment-rules/${rule.data.id}`,
      {
        cookie: manager.cookie,
        body: { isActive: false },
      },
    );
    const afterDisable = await newTicket();
    const t3 = await orchestrator.api(
      "GET",
      `/api/v1/tickets/${afterDisable.data.id}`,
      {
        cookie: manager.cookie,
      },
    );
    expect(t3.data.ticket.assignee_id).toBeNull();
  });
});

describe("Equipe", () => {
  test("gestor cadastra agente, que acessa o console", async () => {
    const created = await orchestrator.api("POST", "/api/v1/team", {
      cookie: manager.cookie,
      body: {
        name: "Julia Costa",
        email: "julia@campus.test",
        password: "senha-segura-1",
        role: "agent",
      },
    });
    expect(created.status).toBe(201);
    expect(created.data.role).toBe("agent");

    const cookie = await orchestrator.login({
      email: "julia@campus.test",
      password: "senha-segura-1",
      role: "agent",
    });
    expect(cookie).toMatch(/^session_id=/);
  });

  test("desativar membro encerra sessões e devolve chamados à fila", async () => {
    const member = await orchestrator.createUserAndLogin({ role: "agent" });
    const deactivate = await orchestrator.api(
      "PATCH",
      `/api/v1/team/${member.id}`,
      {
        cookie: manager.cookie,
        body: { isActive: false },
      },
    );
    expect(deactivate.status).toBe(200);
    expect(deactivate.data.is_active).toBe(false);

    const session = await orchestrator.api("GET", "/api/v1/user", {
      cookie: member.cookie,
    });
    expect(session.status).toBe(401);
  });

  test("gestor não altera o próprio acesso", async () => {
    const { status } = await orchestrator.api(
      "PATCH",
      `/api/v1/team/${manager.id}`,
      {
        cookie: manager.cookie,
        body: { isActive: false },
      },
    );
    expect(status).toBe(400);
  });
});
