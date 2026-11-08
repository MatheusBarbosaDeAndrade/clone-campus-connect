import orchestrator from "test/orchestrator.js";

let requester;
let otherUser;
let agent;
let manager;
let categoryId;

beforeAll(async () => {
  await orchestrator.resetDatabase();
  requester = await orchestrator.createUserAndLogin({ name: "João Silva" });
  otherUser = await orchestrator.createUserAndLogin({ name: "Maria Souza" });
  agent = await orchestrator.createUserAndLogin({
    name: "Carlos Agente",
    role: "agent",
  });
  manager = await orchestrator.createUserAndLogin({
    name: "Ana Gestora",
    role: "manager",
  });
  const categories = await orchestrator.api("GET", "/api/v1/categories", {
    cookie: requester.cookie,
  });
  categoryId = categories.data.find((c) => c.name === "Infraestrutura").id;
});
afterAll(() => orchestrator.end());

async function createTicket(owner = requester, overrides = {}) {
  const { status, data } = await orchestrator.api("POST", "/api/v1/tickets", {
    cookie: owner.cookie,
    body: {
      title: "Ar condicionado quebrado na sala 204B",
      description: "O aparelho está emitindo ruído excessivo e não resfria.",
      categoryId,
      priority: "alta",
      ...overrides,
    },
  });
  expect(status).toBe(201);
  return data.id;
}

describe("Criação de chamados", () => {
  test("cria chamado com status aberto, prazo de SLA e histórico", async () => {
    const id = await createTicket();
    const { status, data } = await orchestrator.api(
      "GET",
      `/api/v1/tickets/${id}`,
      {
        cookie: requester.cookie,
      },
    );
    expect(status).toBe(200);
    expect(data.ticket.status).toBe("aberto");
    expect(data.ticket.priority).toBe("alta");
    expect(data.ticket.category_name).toBe("Infraestrutura");
    const slaHours =
      (new Date(data.ticket.sla_due_at) - new Date(data.ticket.created_at)) /
      3600000;
    expect(Math.round(slaHours)).toBe(8);
    expect(data.events.map((e) => e.type)).toEqual(["created"]);
  });

  test("valida os dados", async () => {
    const invalid = [
      { title: "abc" },
      { description: "curta" },
      { priority: "urgentissima" },
      { categoryId: 99999 },
    ];
    for (const override of invalid) {
      const { status } = await orchestrator.api("POST", "/api/v1/tickets", {
        cookie: requester.cookie,
        body: {
          title: "Título válido",
          description: "Descrição suficientemente longa.",
          categoryId,
          priority: "media",
          ...override,
        },
      });
      expect(status).toBe(400);
    }
  });

  test("exige autenticação", async () => {
    const { status } = await orchestrator.api("POST", "/api/v1/tickets", {
      body: { title: "x" },
    });
    expect(status).toBe(401);
  });

  test("gestores recebem notificação de chamado sem responsável", async () => {
    const id = await createTicket();
    const { data } = await orchestrator.api("GET", "/api/v1/notifications", {
      cookie: manager.cookie,
    });
    expect(
      data.items.some((n) => n.ticket_id === id && n.type === "ticket_created"),
    ).toBe(true);
  });
});

describe("Isolamento entre usuários", () => {
  test("usuário não vê nem altera chamado de outro usuário", async () => {
    const id = await createTicket(requester);

    const view = await orchestrator.api("GET", `/api/v1/tickets/${id}`, {
      cookie: otherUser.cookie,
    });
    expect(view.status).toBe(404);

    const close = await orchestrator.api("PATCH", `/api/v1/tickets/${id}`, {
      cookie: otherUser.cookie,
      body: { status: "fechado" },
    });
    expect(close.status).toBe(404);

    const message = await orchestrator.api(
      "POST",
      `/api/v1/tickets/${id}/messages`,
      {
        cookie: otherUser.cookie,
        body: { body: "Intromissão" },
      },
    );
    expect(message.status).toBe(404);

    const list = await orchestrator.api("GET", "/api/v1/tickets", {
      cookie: otherUser.cookie,
    });
    expect(list.data.some((t) => t.id === id)).toBe(false);
  });

  test("usuário não pode alterar prioridade/responsável nem escalar", async () => {
    const id = await createTicket();
    const patch = await orchestrator.api("PATCH", `/api/v1/tickets/${id}`, {
      cookie: requester.cookie,
      body: { status: "em_andamento" },
    });
    expect(patch.status).toBe(403);
    const escalate = await orchestrator.api(
      "POST",
      `/api/v1/tickets/${id}/escalate`,
      {
        cookie: requester.cookie,
      },
    );
    expect(escalate.status).toBe(403);
    const exportCsv = await orchestrator.api("GET", "/api/v1/tickets/export", {
      cookie: requester.cookie,
    });
    expect(exportCsv.status).toBe(403);
  });

  test("busca e filtro por status em Meus Chamados", async () => {
    const id = await createTicket(requester, {
      title: "Problema exclusivo de busca XYZ",
    });
    const search = await orchestrator.api(
      "GET",
      "/api/v1/tickets?search=exclusivo%20de%20busca",
      {
        cookie: requester.cookie,
      },
    );
    expect(search.data.map((t) => t.id)).toEqual([id]);
    const byCode = await orchestrator.api(
      "GET",
      `/api/v1/tickets?search=%23${id}`,
      {
        cookie: requester.cookie,
      },
    );
    expect(byCode.data.map((t) => t.id)).toEqual([id]);
    const closed = await orchestrator.api(
      "GET",
      "/api/v1/tickets?status=fechado",
      {
        cookie: requester.cookie,
      },
    );
    expect(closed.data.every((t) => t.status === "fechado")).toBe(true);
  });
});

describe("Gestão pela equipe", () => {
  test("atribui, altera prioridade e status, registrando histórico e notificações", async () => {
    const id = await createTicket();

    const update = await orchestrator.api("PATCH", `/api/v1/tickets/${id}`, {
      cookie: manager.cookie,
      body: { assigneeId: agent.id, priority: "critica", status: "em_analise" },
    });
    expect(update.status).toBe(200);
    expect(update.data.assignee_id).toBe(agent.id);
    expect(update.data.priority).toBe("critica");
    expect(update.data.status).toBe("em_analise");
    const slaHours =
      (new Date(update.data.sla_due_at) -
        new Date(update.data.sla_started_at)) /
      3600000;
    expect(Math.round(slaHours)).toBe(2);

    const details = await orchestrator.api("GET", `/api/v1/tickets/${id}`, {
      cookie: requester.cookie,
    });
    expect(details.data.events.map((e) => e.type)).toEqual([
      "created",
      "priority_changed",
      "assigned",
      "status_changed",
    ]);

    const agentNotifications = await orchestrator.api(
      "GET",
      "/api/v1/notifications",
      {
        cookie: agent.cookie,
      },
    );
    expect(
      agentNotifications.data.items.some(
        (n) => n.ticket_id === id && n.type === "ticket_assigned",
      ),
    ).toBe(true);

    const requesterNotifications = await orchestrator.api(
      "GET",
      "/api/v1/notifications",
      {
        cookie: requester.cookie,
      },
    );
    const statusNotification = requesterNotifications.data.items.find(
      (n) => n.ticket_id === id && n.type === "ticket_updated",
    );
    expect(statusNotification.body).toContain("Em Análise");
  });

  test("não atribui a usuário comum", async () => {
    const id = await createTicket();
    const { status } = await orchestrator.api(
      "PATCH",
      `/api/v1/tickets/${id}`,
      {
        cookie: manager.cookie,
        body: { assigneeId: otherUser.id },
      },
    );
    expect(status).toBe(400);
  });

  test("fila: abas e contadores", async () => {
    const queue = await orchestrator.api(
      "GET",
      "/api/v1/tickets?tab=unassigned",
      {
        cookie: agent.cookie,
      },
    );
    expect(queue.status).toBe(200);
    expect(queue.data.length).toBeGreaterThan(0);
    expect(queue.data.every((t) => t.assignee_id === null)).toBe(true);

    const critical = await orchestrator.api(
      "GET",
      "/api/v1/tickets?tab=critical",
      {
        cookie: agent.cookie,
      },
    );
    expect(critical.data.every((t) => t.priority === "critica")).toBe(true);
  });

  test("escalar eleva a prioridade e notifica gestores", async () => {
    const id = await createTicket(requester, { priority: "media" });
    const { status, data } = await orchestrator.api(
      "POST",
      `/api/v1/tickets/${id}/escalate`,
      {
        cookie: agent.cookie,
      },
    );
    expect(status).toBe(200);
    expect(data.priority).toBe("alta");
    const notifications = await orchestrator.api(
      "GET",
      "/api/v1/notifications",
      {
        cookie: manager.cookie,
      },
    );
    expect(
      notifications.data.items.some(
        (n) => n.ticket_id === id && n.type === "ticket_escalated",
      ),
    ).toBe(true);
  });

  test("exporta CSV para a equipe", async () => {
    const { status, data, headers } = await orchestrator.api(
      "GET",
      "/api/v1/tickets/export",
      {
        cookie: manager.cookie,
      },
    );
    expect(status).toBe(200);
    expect(headers.get("content-type")).toContain("text/csv");
    expect(data.split("\r\n")[0]).toContain("Assunto");
  });
});

describe("Fechar e reabrir pelo solicitante", () => {
  test("fecha, bloqueia mensagens, reabre e reinicia o SLA", async () => {
    const id = await createTicket();

    const invalidReopen = await orchestrator.api(
      "PATCH",
      `/api/v1/tickets/${id}`,
      {
        cookie: requester.cookie,
        body: { status: "reaberto" },
      },
    );
    expect(invalidReopen.status).toBe(400);

    const close = await orchestrator.api("PATCH", `/api/v1/tickets/${id}`, {
      cookie: requester.cookie,
      body: { status: "fechado" },
    });
    expect(close.status).toBe(200);
    expect(close.data.status).toBe("fechado");
    expect(close.data.closed_at).not.toBeNull();

    const blocked = await orchestrator.api(
      "POST",
      `/api/v1/tickets/${id}/messages`,
      {
        cookie: requester.cookie,
        body: { body: "Ainda está com problema" },
      },
    );
    expect(blocked.status).toBe(400);

    const reopen = await orchestrator.api("PATCH", `/api/v1/tickets/${id}`, {
      cookie: requester.cookie,
      body: { status: "reaberto" },
    });
    expect(reopen.status).toBe(200);
    expect(reopen.data.status).toBe("reaberto");
    expect(reopen.data.closed_at).toBeNull();
    expect(
      new Date(reopen.data.sla_started_at) >= new Date(close.data.closed_at),
    ).toBe(true);
  });
});

describe("Mensagens e notas internas", () => {
  test("nota interna é invisível para o solicitante; resposta pública notifica", async () => {
    const id = await createTicket();

    const note = await orchestrator.api(
      "POST",
      `/api/v1/tickets/${id}/messages`,
      {
        cookie: manager.cookie,
        body: { body: "Escalar equipe de plantão", internal: true },
      },
    );
    expect(note.status).toBe(201);

    const reply = await orchestrator.api(
      "POST",
      `/api/v1/tickets/${id}/messages`,
      {
        cookie: agent.cookie,
        body: { body: "Equipe de manutenção a caminho." },
      },
    );
    expect(reply.status).toBe(201);

    const userView = await orchestrator.api("GET", `/api/v1/tickets/${id}`, {
      cookie: requester.cookie,
    });
    expect(userView.data.messages.map((m) => m.body)).toEqual([
      "Equipe de manutenção a caminho.",
    ]);
    expect(userView.data.events.some((e) => e.type === "note_added")).toBe(
      false,
    );
    expect(userView.data.ticket.first_response_at).not.toBeNull();

    const staffView = await orchestrator.api("GET", `/api/v1/tickets/${id}`, {
      cookie: manager.cookie,
    });
    expect(staffView.data.messages).toHaveLength(2);

    const userInternal = await orchestrator.api(
      "POST",
      `/api/v1/tickets/${id}/messages`,
      {
        cookie: requester.cookie,
        body: { body: "tentativa", internal: true },
      },
    );
    expect(userInternal.status).toBe(403);

    const notifications = await orchestrator.api(
      "GET",
      "/api/v1/notifications",
      {
        cookie: requester.cookie,
      },
    );
    expect(
      notifications.data.items.some(
        (n) => n.ticket_id === id && n.type === "new_message",
      ),
    ).toBe(true);
  });

  test("marca notificações como lidas", async () => {
    const before = await orchestrator.api("GET", "/api/v1/notifications", {
      cookie: requester.cookie,
    });
    expect(before.data.unread).toBeGreaterThan(0);

    const one = before.data.items[0];
    const markOne = await orchestrator.api("PATCH", "/api/v1/notifications", {
      cookie: requester.cookie,
      body: { id: one.id },
    });
    expect(markOne.status).toBe(200);

    const foreign = await orchestrator.api("PATCH", "/api/v1/notifications", {
      cookie: otherUser.cookie,
      body: { id: one.id },
    });
    expect(foreign.status).toBe(404);

    await orchestrator.api("PATCH", "/api/v1/notifications", {
      cookie: requester.cookie,
      body: { all: true },
    });
    const after = await orchestrator.api("GET", "/api/v1/notifications", {
      cookie: requester.cookie,
    });
    expect(after.data.unread).toBe(0);
  });
});

describe("Anexos", () => {
  const PNG = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
      "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
    "hex",
  );

  async function upload(
    id,
    cookie,
    { body = PNG, type = "image/png", name = "foto.png" } = {},
  ) {
    const response = await fetch(
      `http://localhost:3000/api/v1/tickets/${id}/attachments`,
      {
        method: "POST",
        headers: {
          "Content-Type": type,
          "X-Filename": encodeURIComponent(name),
          Cookie: cookie,
        },
        body,
      },
    );
    return { status: response.status, data: await response.json() };
  }

  test("envia e baixa anexo com controle de acesso", async () => {
    const id = await createTicket();
    const created = await upload(id, requester.cookie, {
      name: "foto ação.png",
    });
    expect(created.status).toBe(201);
    expect(created.data.filename).toBe("foto ação.png");

    const download = await fetch(
      `http://localhost:3000/api/v1/attachments/${created.data.id}`,
      {
        headers: { Cookie: requester.cookie },
      },
    );
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer()).equals(PNG)).toBe(true);

    const foreign = await fetch(
      `http://localhost:3000/api/v1/attachments/${created.data.id}`,
      {
        headers: { Cookie: otherUser.cookie },
      },
    );
    expect(foreign.status).toBe(404);

    const staff = await fetch(
      `http://localhost:3000/api/v1/attachments/${created.data.id}`,
      {
        headers: { Cookie: agent.cookie },
      },
    );
    expect(staff.status).toBe(200);
  });

  test("rejeita tipo não permitido e conteúdo falsificado", async () => {
    const id = await createTicket();
    const exe = await upload(id, requester.cookie, {
      type: "application/x-msdownload",
      name: "a.exe",
    });
    expect(exe.status).toBe(400);
    const fake = await upload(id, requester.cookie, {
      body: Buffer.from("não sou png"),
      name: "x.png",
    });
    expect(fake.status).toBe(400);
  });

  test("rejeita arquivo maior que 10 MB", async () => {
    const id = await createTicket();
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const result = await upload(id, requester.cookie, { body: big });
    expect(result.status).toBe(413);
  });
});
