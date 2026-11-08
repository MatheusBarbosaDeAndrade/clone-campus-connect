import database from "infra/database.js";
import orchestrator, { BASE_URL } from "test/orchestrator.js";

let manager;
let categoryId;

beforeAll(async () => {
  await orchestrator.resetDatabase();
  manager = await orchestrator.createUserAndLogin({
    name: "Ana Gestora",
    role: "manager",
  });
  const categories = await orchestrator.api("GET", "/api/v1/categories", {
    cookie: manager.cookie,
  });
  categoryId = categories.data[0].id;
});
afterAll(() => orchestrator.end());

// Usuário com um chamado, uma resposta pública da equipe e uma nota interna.
async function userWithTicket(name) {
  const account = await orchestrator.createUserAndLogin({
    name,
    phone: `119${String(Date.now()).slice(-8)}`,
  });
  const created = await orchestrator.api("POST", "/api/v1/tickets", {
    cookie: account.cookie,
    body: {
      title: "Projetor da sala 12 sem imagem",
      description: "O projetor liga, mas não exibe a imagem do notebook.",
      categoryId,
      priority: "media",
    },
  });
  const ticketId = created.data.id;
  for (const [body, internal] of [
    ["Vamos verificar hoje.", false],
    ["Nota interna da equipe", true],
  ]) {
    await orchestrator.api("POST", `/api/v1/tickets/${ticketId}/messages`, {
      cookie: manager.cookie,
      body: { body, internal },
    });
  }
  await orchestrator.api("POST", `/api/v1/tickets/${ticketId}/messages`, {
    cookie: account.cookie,
    body: { body: "Obrigado!" },
  });
  return { ...account, ticketId };
}

describe("Cadastro registra o aceite da Política de Privacidade", () => {
  test("guarda data e versão do aceite", async () => {
    const { status, data } = await orchestrator.api("POST", "/api/v1/users", {
      body: {
        name: "Titular Aceite",
        phone: "11944443333",
        email: "aceite@campus.test",
        password: "senha-segura-123",
        acceptPrivacy: true,
      },
    });
    expect(status).toBe(201);
    const row = await database.query(
      "SELECT privacy_accepted_at, privacy_version FROM users WHERE id = $1;",
      [data.id],
    );
    expect(row.rows[0].privacy_accepted_at).toBeInstanceOf(Date);
    expect(row.rows[0].privacy_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("página /privacidade é pública", async () => {
    const response = await fetch(`${BASE_URL}/privacidade`);
    expect(response.status).toBe(200);
    expect(await response.text()).toMatch(/Política de Privacidade/);
  });
});

describe("Exportação dos dados (GET /api/v1/user/export)", () => {
  test("exige login", async () => {
    const { status } = await orchestrator.api("GET", "/api/v1/user/export");
    expect(status).toBe(401);
  });

  test("traz perfil, chamados e mensagens públicas, sem notas internas", async () => {
    const account = await userWithTicket("Titular Exporta");
    const { status, data, headers } = await orchestrator.api(
      "GET",
      "/api/v1/user/export",
      { cookie: account.cookie },
    );
    expect(status).toBe(200);
    expect(headers.get("content-disposition")).toMatch(/attachment/);
    expect(data.profile.email).toBe(account.email);
    expect(data.profile.password_hash).toBeUndefined();
    expect(data.tickets).toHaveLength(1);
    const bodies = data.tickets[0].messages.map((m) => m.body);
    expect(bodies).toEqual(["Vamos verificar hoje.", "Obrigado!"]);
    expect(JSON.stringify(data)).not.toMatch(/Nota interna/);
    expect(data.notifications.length).toBeGreaterThan(0);
  });
});

describe("Exclusão da conta (DELETE /api/v1/user)", () => {
  test("exige a senha correta", async () => {
    const account = await orchestrator.createUserAndLogin();
    const { status, data } = await orchestrator.api("DELETE", "/api/v1/user", {
      cookie: account.cookie,
      body: { currentPassword: "senha-errada-1" },
    });
    expect(status).toBe(400);
    expect(data.field).toBe("currentPassword");
  });

  test("conta da equipe não se autoexclui", async () => {
    const agent = await orchestrator.createUserAndLogin({ role: "agent" });
    const { status } = await orchestrator.api("DELETE", "/api/v1/user", {
      cookie: agent.cookie,
      body: { currentPassword: agent.password },
    });
    expect(status).toBe(403);
  });

  test("anonimiza os dados pessoais e mantém o chamado no histórico", async () => {
    const account = await userWithTicket("Fulano Removível");
    const otherDevice = await orchestrator.login(account);

    const { status, headers } = await orchestrator.api(
      "DELETE",
      "/api/v1/user",
      {
        cookie: account.cookie,
        body: { currentPassword: account.password },
      },
    );
    expect(status).toBe(200);
    expect(headers.getSetCookie()[0]).toMatch(/session_id=invalid;.*Max-Age=0/);

    // Todas as sessões foram encerradas e não é mais possível entrar.
    for (const cookie of [account.cookie, otherDevice]) {
      const me = await orchestrator.api("GET", "/api/v1/user", { cookie });
      expect(me.status).toBe(401);
    }
    await expect(orchestrator.login(account)).rejects.toThrow();

    // Nome, email e telefone apagados.
    const row = await database.query(
      "SELECT name, email, phone, is_active, anonymized_at FROM users WHERE id = $1;",
      [account.id],
    );
    expect(row.rows[0]).toMatchObject({
      name: "Usuário removido",
      phone: null,
      is_active: false,
    });
    expect(row.rows[0].email).toMatch(/@anonimizado\.invalid$/);
    expect(row.rows[0].anonymized_at).toBeInstanceOf(Date);

    // O chamado continua para a equipe, sem identificar a pessoa.
    const ticket = await orchestrator.api(
      "GET",
      `/api/v1/tickets/${account.ticketId}`,
      { cookie: manager.cookie },
    );
    expect(ticket.status).toBe(200);
    expect(ticket.data.ticket.requester_name).toBe("Usuário removido");

    // Notificações da equipe não mostram mais o nome.
    const leftovers = await database.query(
      "SELECT count(*)::int AS total FROM notifications WHERE body LIKE '%Fulano Removível%';",
    );
    expect(leftovers.rows[0].total).toBe(0);

    // O email fica livre para um novo cadastro.
    const again = await orchestrator.api("POST", "/api/v1/users", {
      body: {
        name: "Fulano Novo",
        phone: "11933332222",
        email: account.email,
        password: "senha-segura-123",
        acceptPrivacy: true,
      },
    });
    expect(again.status).toBe(201);
  });
});
