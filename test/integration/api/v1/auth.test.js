import orchestrator from "test/orchestrator.js";

beforeAll(() => orchestrator.resetDatabase());
afterAll(() => orchestrator.end());

describe("Cadastro (POST /api/v1/users)", () => {
  test("cria conta, não expõe a senha e envia o código de confirmação", async () => {
    const { status, data, headers } = await orchestrator.api(
      "POST",
      "/api/v1/users",
      {
        body: {
          name: "João Silva",
          phone: "(11) 99999-1111",
          email: "Joao.Silva@Campus.test",
          password: "senha-segura-123",
          acceptPrivacy: true,
        },
      },
    );
    expect(status).toBe(201);
    expect(data.email).toBe("joao.silva@campus.test");
    expect(data.phone).toBe("11999991111");
    expect(data.role).toBe("user");
    expect(data.password_hash).toBeUndefined();
    expect(data.password).toBeUndefined();
    // Sem sessão até confirmar o código enviado ao e-mail.
    expect(headers.getSetCookie()).toHaveLength(0);
    expect(data.verification.email).toBe("jo••••••••@campus.test");

    const code = await orchestrator.getLoginCode("joao.silva@campus.test");
    const verified = await orchestrator.verifyCode(
      data.verification.challenge,
      code,
    );
    expect(verified.status).toBe(201);
    expect(verified.headers.getSetCookie()[0]).toMatch(/session_id=.+HttpOnly/);
  });

  test("não permite email duplicado (sem diferenciar maiúsculas)", async () => {
    const { status, data } = await orchestrator.api("POST", "/api/v1/users", {
      body: {
        name: "Outro João",
        phone: "11988887777",
        email: "JOAO.SILVA@campus.test",
        password: "senha-segura-123",
        acceptPrivacy: true,
      },
    });
    expect(status).toBe(400);
    expect(data.field).toBe("email");
  });

  test("valida campos obrigatórios", async () => {
    const cases = [
      [
        {
          name: "",
          phone: "11999990000",
          email: "a@b.co",
          password: "12345678",
        },
        "name",
      ],
      [
        { name: "Fulano", phone: "123", email: "a@b.co", password: "12345678" },
        "phone",
      ],
      [
        {
          name: "Fulano",
          phone: "11999990000",
          email: "invalido",
          password: "12345678",
        },
        "email",
      ],
      [
        {
          name: "Fulano",
          phone: "11999990000",
          email: "a@b.co",
          password: "123",
        },
        "password",
      ],
    ];
    for (const [body, field] of cases) {
      const { status, data } = await orchestrator.api("POST", "/api/v1/users", {
        body: { ...body, acceptPrivacy: true },
      });
      expect(status).toBe(400);
      expect(data.field).toBe(field);
    }
  });

  test("exige o aceite da Política de Privacidade", async () => {
    for (const acceptPrivacy of [undefined, false, "true"]) {
      const { status, data } = await orchestrator.api("POST", "/api/v1/users", {
        body: {
          name: "Sem Aceite",
          phone: "11955554444",
          email: "sem.aceite@campus.test",
          password: "senha-segura-123",
          acceptPrivacy,
        },
      });
      expect(status).toBe(400);
      expect(data.field).toBe("acceptPrivacy");
    }
  });

  test("ignora tentativa de se cadastrar como gestor", async () => {
    const { status, data } = await orchestrator.api("POST", "/api/v1/users", {
      body: {
        name: "Espertinho",
        phone: "11977776666",
        email: "esperto@campus.test",
        password: "senha-segura-123",
        role: "manager",
        acceptPrivacy: true,
      },
    });
    expect(status).toBe(201);
    expect(data.role).toBe("user");
  });

  test("exige JSON (proteção contra envio de formulários externos)", async () => {
    const response = await fetch("http://localhost:3000/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=x",
    });
    expect(response.status).toBe(403);
  });
});

describe("Sessões (POST/DELETE /api/v1/sessions)", () => {
  test("login por email e por telefone, confirmado pelo código do e-mail", async () => {
    const account = await orchestrator.createUser({ phone: "21912345678" });
    for (const login of [account.email, "(21) 91234-5678"]) {
      const { status, data, headers } = await orchestrator.api(
        "POST",
        "/api/v1/sessions",
        {
          body: { login, password: account.password },
        },
      );
      // Senha certa ainda não cria sessão: só envia o código.
      expect(status).toBe(202);
      expect(headers.getSetCookie()).toHaveLength(0);
      expect(data.challenge).toHaveLength(64);

      const code = await orchestrator.getLoginCode(account.email);
      const verified = await orchestrator.verifyCode(data.challenge, code);
      expect(verified.status).toBe(201);
      expect((await verified.json()).role).toBe("user");
      expect(orchestrator.extractSessionCookie(verified)).toMatch(
        /^session_id=/,
      );
    }
  });

  test("código errado, reutilizado ou substituído não cria sessão", async () => {
    const account = await orchestrator.createUser();
    const start = () =>
      orchestrator.api("POST", "/api/v1/sessions", {
        body: { login: account.email, password: account.password },
      });

    const first = (await start()).data;
    const firstCode = await orchestrator.getLoginCode(account.email);
    const wrongCode = firstCode === "000000" ? "111111" : "000000";
    const wrong = await orchestrator.verifyCode(first.challenge, wrongCode);
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).message).toMatch(/Restam 4 tentativas/);

    // Pedir outro código invalida o anterior.
    const second = (await start()).data;
    const oldOne = await orchestrator.verifyCode(first.challenge, firstCode);
    expect(oldOne.status).toBe(401);

    const secondCode = await orchestrator.getLoginCode(account.email);
    expect(
      (await orchestrator.verifyCode(second.challenge, secondCode)).status,
    ).toBe(201);
    // Uso único.
    expect(
      (await orchestrator.verifyCode(second.challenge, secondCode)).status,
    ).toBe(401);
  });

  test("após 5 códigos errados, nem o código certo funciona", async () => {
    const account = await orchestrator.createUser();
    const { data } = await orchestrator.api("POST", "/api/v1/sessions", {
      body: { login: account.email, password: account.password },
    });
    const code = await orchestrator.getLoginCode(account.email);
    const wrongCode = code === "000000" ? "111111" : "000000";
    const statuses = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(
        (await orchestrator.verifyCode(data.challenge, wrongCode)).status,
      );
    }
    expect(statuses).toEqual([400, 400, 400, 400, 401]);
    expect((await orchestrator.verifyCode(data.challenge, code)).status).toBe(
      401,
    );
  });

  test("limita o envio de códigos para a mesma conta", async () => {
    const account = await orchestrator.createUser();
    const start = () =>
      orchestrator.api("POST", "/api/v1/sessions", {
        body: { login: account.email, password: account.password },
      });
    for (let i = 0; i < 5; i++) expect((await start()).status).toBe(202);
    expect((await start()).status).toBe(429);
  });

  test("senha errada ou usuário inexistente retornam a mesma mensagem", async () => {
    const account = await orchestrator.createUser();
    const wrong = await orchestrator.api("POST", "/api/v1/sessions", {
      body: { login: account.email, password: "senha-errada-1" },
    });
    const missing = await orchestrator.api("POST", "/api/v1/sessions", {
      body: { login: "naoexiste@campus.test", password: "senha-errada-1" },
    });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.data.message).toBe(missing.data.message);
  });

  test("usuário comum não entra pelo portal do gestor", async () => {
    const account = await orchestrator.createUser();
    const { status } = await orchestrator.api("POST", "/api/v1/sessions", {
      body: {
        login: account.email,
        password: account.password,
        portal: "staff",
      },
    });
    expect(status).toBe(403);
  });

  test("'Lembrar-me' cria cookie persistente; sem ele, cookie de sessão", async () => {
    const account = await orchestrator.createUser({ role: "manager" });
    async function loginWith(remember) {
      const { data } = await orchestrator.api("POST", "/api/v1/sessions", {
        body: {
          login: account.email,
          password: account.password,
          portal: "staff",
          remember,
        },
      });
      const code = await orchestrator.getLoginCode(account.email);
      return orchestrator.verifyCode(data.challenge, code);
    }
    const remember = await loginWith(true);
    const normal = await loginWith(false);
    expect(remember.headers.getSetCookie()[0]).toMatch(/Max-Age=2592000/);
    expect(normal.headers.getSetCookie()[0]).not.toMatch(/Max-Age/);
  });

  test("logout invalida a sessão", async () => {
    const account = await orchestrator.createUserAndLogin();
    const before = await orchestrator.api("GET", "/api/v1/user", {
      cookie: account.cookie,
    });
    expect(before.status).toBe(200);

    const logout = await orchestrator.api("DELETE", "/api/v1/sessions", {
      cookie: account.cookie,
    });
    expect(logout.status).toBe(200);

    const after = await orchestrator.api("GET", "/api/v1/user", {
      cookie: account.cookie,
    });
    expect(after.status).toBe(401);
  });
});

describe("Perfil (GET/PATCH /api/v1/user)", () => {
  test("exige autenticação", async () => {
    const { status } = await orchestrator.api("GET", "/api/v1/user");
    expect(status).toBe(401);
  });

  test("atualiza nome e telefone", async () => {
    const account = await orchestrator.createUserAndLogin();
    const { status, data } = await orchestrator.api("PATCH", "/api/v1/user", {
      cookie: account.cookie,
      body: { name: "Nome Atualizado", phone: "(31) 98888-7777" },
    });
    expect(status).toBe(200);
    expect(data.name).toBe("Nome Atualizado");
    expect(data.phone).toBe("31988887777");
  });

  test("troca de senha exige a senha atual correta", async () => {
    const account = await orchestrator.createUserAndLogin();
    const wrong = await orchestrator.api("PATCH", "/api/v1/user", {
      cookie: account.cookie,
      body: { currentPassword: "incorreta-123", newPassword: "nova-senha-123" },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.data.field).toBe("currentPassword");

    const ok = await orchestrator.api("PATCH", "/api/v1/user", {
      cookie: account.cookie,
      body: {
        currentPassword: account.password,
        newPassword: "nova-senha-123",
      },
    });
    expect(ok.status).toBe(200);
    await expect(
      orchestrator.login({ ...account, password: "nova-senha-123" }),
    ).resolves.toMatch(/^session_id=/);
  });
});

describe("Recuperação de senha (/api/v1/password-reset)", () => {
  test("envia email com link, redefine a senha e encerra sessões antigas", async () => {
    await orchestrator.deleteAllEmails();
    const account = await orchestrator.createUserAndLogin();

    const request = await orchestrator.api("POST", "/api/v1/password-reset", {
      body: { email: account.email },
    });
    expect(request.status).toBe(202);

    const email = await orchestrator.getLastEmail();
    expect(email.to).toEqual([account.email]);
    const token = email.text.match(/token=([a-f0-9]{64})/)[1];

    const reset = await orchestrator.api("PATCH", "/api/v1/password-reset", {
      body: { token, password: "senha-nova-456" },
    });
    expect(reset.status).toBe(200);

    const oldSession = await orchestrator.api("GET", "/api/v1/user", {
      cookie: account.cookie,
    });
    expect(oldSession.status).toBe(401);

    await expect(
      orchestrator.login({ ...account, password: "senha-nova-456" }),
    ).resolves.toMatch(/^session_id=/);

    const reuse = await orchestrator.api("PATCH", "/api/v1/password-reset", {
      body: { token, password: "outra-senha-789" },
    });
    expect(reuse.status).toBe(400);
  });

  test("não revela se o email existe", async () => {
    await orchestrator.deleteAllEmails();
    const { status } = await orchestrator.api(
      "POST",
      "/api/v1/password-reset",
      {
        body: { email: "ninguem@campus.test" },
      },
    );
    expect(status).toBe(202);
    expect(await orchestrator.getLastEmail()).toBeNull();
  });
});
