import orchestrator, { BASE_URL } from "test/orchestrator.js";

beforeAll(() => orchestrator.resetDatabase());
afterAll(() => orchestrator.end());

function wrongLogin(login) {
  return orchestrator.api("POST", "/api/v1/sessions", {
    body: { login, password: "senha-errada-000" },
  });
}

describe("Limite de tentativas", () => {
  test("bloqueia a conta após 10 falhas de login, inclusive para a senha certa", async () => {
    const account = await orchestrator.createUser({ phone: "11977776666" });
    for (let i = 0; i < 10; i++) {
      expect((await wrongLogin(account.email)).status).toBe(401);
    }
    // Email com outra capitalização e telefone com máscara contam como a mesma conta.
    const blocked = await wrongLogin(account.email.toUpperCase());
    expect(blocked.status).toBe(429);
    expect(blocked.data.name).toBe("TooManyRequestsError");
    expect(blocked.data.message).toMatch(/Aguarde \d+ minutos?/);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);

    await expect(orchestrator.login(account)).rejects.toThrow(/429/);
  });

  test("login correto zera o contador de falhas", async () => {
    const account = await orchestrator.createUser();
    for (let i = 0; i < 9; i++) await wrongLogin(account.email);
    await expect(orchestrator.login(account)).resolves.toMatch(/^session_id=/);
    for (let i = 0; i < 9; i++) {
      expect((await wrongLogin(account.email)).status).toBe(401);
    }
  });

  test("limita pedidos de recuperação de senha por email (sem revelar se existe)", async () => {
    for (const email of ["existe@campus.test", "nao-existe@campus.test"]) {
      if (email.startsWith("existe")) await orchestrator.createUser({ email });
      for (let i = 0; i < 3; i++) {
        const ok = await orchestrator.api("POST", "/api/v1/password-reset", {
          body: { email },
        });
        expect(ok.status).toBe(202);
      }
      const blocked = await orchestrator.api("POST", "/api/v1/password-reset", {
        body: { email },
      });
      expect(blocked.status).toBe(429);
    }
  });

  test("limita tentativas com senha atual incorreta na troca de senha", async () => {
    const account = await orchestrator.createUserAndLogin();
    const attempt = () =>
      orchestrator.api("PATCH", "/api/v1/user", {
        cookie: account.cookie,
        body: { currentPassword: "errada-1234", newPassword: "nova-senha-123" },
      });
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(400);
    expect((await attempt()).status).toBe(429);
  });
});

describe("Troca de senha pelo perfil", () => {
  test("encerra as sessões de outros dispositivos e mantém a atual", async () => {
    const account = await orchestrator.createUserAndLogin();
    const otherDevice = await orchestrator.login(account);

    const changed = await orchestrator.api("PATCH", "/api/v1/user", {
      cookie: account.cookie,
      body: {
        currentPassword: account.password,
        newPassword: "nova-senha-123",
      },
    });
    expect(changed.status).toBe(200);

    const current = await orchestrator.api("GET", "/api/v1/user", {
      cookie: account.cookie,
    });
    expect(current.status).toBe(200);
    const other = await orchestrator.api("GET", "/api/v1/user", {
      cookie: otherDevice,
    });
    expect(other.status).toBe(401);
  });
});

describe("Cabeçalhos de segurança", () => {
  test("páginas e APIs enviam CSP, anti-clickjacking e nosniff", async () => {
    for (const path of ["/login", "/api/v1/status"]) {
      const response = await fetch(`${BASE_URL}${path}`);
      expect(response.headers.get("content-security-policy")).toMatch(
        /frame-ancestors 'none'/,
      );
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBeTruthy();
      expect(response.headers.get("x-powered-by")).toBeNull();
    }
  });

  test("página de redefinição de senha não vaza o token pelo Referer", async () => {
    const response = await fetch(`${BASE_URL}/redefinir-senha?token=abc`);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
