// Roteiro E2E dos fluxos principais em navegador real (Firefox headless via
// WebDriver/geckodriver), sem dependências extras. Rode contra a stack de
// produção local (ver README, "Testar a stack de produção localmente"):
//
//   geckodriver --port 4444 &
//   node test/e2e/production-flows.mjs <pasta-para-capturas> <caminho-absoluto-de-um-png>
//
// Variáveis opcionais: E2E_BASE_URL (padrão https://localhost),
// E2E_MAILPIT_URL (padrão http://127.0.0.1:18025),
// E2E_MANAGER_EMAIL / E2E_MANAGER_PASSWORD (gestor criado com manager:create).
import fs from "node:fs";

const WD = "http://localhost:4444";
const BASE = process.env.E2E_BASE_URL || "https://localhost";
const MAILPIT = process.env.E2E_MAILPIT_URL || "http://127.0.0.1:18025";
const [, , shotsDir, attachPath] = process.argv;
const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";
let sid;
const results = [];

async function wd(method, path, body) {
  const res = await fetch(`${WD}/session${sid ? `/${sid}` : ""}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (json.value?.error)
    throw new Error(`${json.value.error}: ${json.value.message}`);
  return json.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, label, timeout = 10000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await sleep(200);
  }
  throw new Error(`Timeout: ${label}${last ? ` (${last.message})` : ""}`);
}
// Espera o React hidratar a página (antes disso, o que se digita é descartado).
const hydrated = () =>
  waitFor(
    () =>
      js(
        "const n = document.querySelector('#__next button, #__next input, #__next a'); return !!n && Object.keys(n).some(k => k.startsWith('__reactProps'));",
      ),
    "hidratação",
  );
const go = async (url) => {
  await wd("POST", "/url", { url: url.startsWith("http") ? url : BASE + url });
  await hydrated();
};
const url = async () => (await wd("GET", "/url")).replace(BASE, "");
const js = (script, args = []) => wd("POST", "/execute/sync", { script, args });
const bodyText = () => js("return document.body.innerText");
const find = async (xpath) =>
  (await wd("POST", "/element", { using: "xpath", value: xpath }))[ELEMENT];
const el = (xpath) => waitFor(() => find(xpath), xpath);
async function click(xpath) {
  const id = await el(xpath);
  await wd("POST", `/element/${id}/click`, {});
}
async function type(xpath, text) {
  const id = await el(xpath);
  await wd("POST", `/element/${id}/clear`, {}).catch(() => {});
  await wd("POST", `/element/${id}/value`, { text });
}
const field = (label) =>
  `//label[normalize-space()='${label}']/following::*[self::input or self::textarea or self::select][1]`;
const button = (text) =>
  `//button[normalize-space()='${text}' or .//*[normalize-space()='${text}']]`;
const waitText = (text, t) =>
  waitFor(async () => (await bodyText()).includes(text), `texto "${text}"`, t);
const waitUrl = (re, t) =>
  waitFor(async () => re.test(await url()), `url ${re}`, t);
async function shot(name) {
  const png = await wd("GET", "/screenshot");
  fs.writeFileSync(`${shotsDir}/${name}.png`, Buffer.from(png, "base64"));
}
async function logout() {
  await wd("DELETE", "/cookie");
}
// Código de acesso enviado ao endereço depois de `since` (lido no Mailpit).
async function enterLoginCode(address, since) {
  const code = await waitFor(async () => {
    const query = encodeURIComponent(
      `to:"${address}" subject:"código de acesso"`,
    );
    const list = await (
      await fetch(`${MAILPIT}/api/v1/search?query=${query}`)
    ).json();
    const latest = list.messages?.[0];
    if (!latest || new Date(latest.Created).getTime() < since) return null;
    return latest.Subject.match(/(\d{6})$/)?.[1];
  }, `código de acesso para ${address}`);
  await type("//input[@name='code']", code);
  await click(button("Confirmar"));
}
// `withCode: false` quando o login deve falhar antes da etapa do código.
async function login(path, login, password, { withCode = true } = {}) {
  await go(path);
  await type("//input[@name='login']", login);
  await type("//input[@name='password']", password);
  const since = Date.now() - 1000;
  await click("//button[@type='submit']");
  if (withCode) await enterLoginCode(login, since);
}
async function step(name, fn) {
  try {
    await fn();
    results.push(["✓", name]);
  } catch (e) {
    results.push(["✗", name, e.message]);
    await shot(`ERRO-${results.length}`).catch(() => {});
  }
}

const user = {
  name: `Bruna E2E ${Date.now().toString(36)}`,
  email: `bruna${Date.now()}@campus.test`,
  phone: `319${String(Date.now()).slice(-8)}`,
  password: "senha-inicial-123",
};
const manager = {
  email: process.env.E2E_MANAGER_EMAIL || "gestora@campus.test",
  password: process.env.E2E_MANAGER_PASSWORD || "gestora-senha-forte-1",
};
let ticketPath;

sid = (
  await wd("POST", "", {
    capabilities: {
      alwaysMatch: {
        acceptInsecureCerts: true,
        "moz:firefoxOptions": { args: ["-headless"] },
      },
    },
  })
).sessionId;
await wd("POST", "/window/rect", { width: 1366, height: 900 });

try {
  await step("Boas-vindas e link da Política de Privacidade", async () => {
    await go("/");
    await waitText("Quer abrir um chamado?");
    await el("//a[@href='/privacidade']");
    await go("/privacidade");
    await waitText("Seus direitos");
    await shot("01-privacidade");
  });

  await step("Cadastro exige aceite da política e cria a conta", async () => {
    await go("/cadastro");
    await type(field("Nome"), user.name);
    await type(field("Telefone"), user.phone);
    await type(field("Email"), user.email);
    await type(field("Senha"), user.password);
    await click(button("Cadastrar"));
    await waitText("É preciso aceitar a Política de Privacidade");
    await shot("02-cadastro-sem-aceite");
    await click("//input[@name='acceptPrivacy']");
    const since = Date.now() - 1000;
    await click(button("Cadastrar"));
    await enterLoginCode(user.email, since);
    await waitUrl(/^\/inicio/);
  });

  await step("Abrir chamado com anexo", async () => {
    await go("/chamados/novo");
    await type(field("Assunto"), "Wi-Fi do bloco C cai toda hora");
    const select = await el(field("Categoria"));
    const optId = (
      await wd("POST", `/element/${select}/elements`, {
        using: "xpath",
        value: "./option[@value!='']",
      })
    )[0][ELEMENT];
    await wd("POST", `/element/${optId}/click`, {});
    await type(
      field("Descrição"),
      "A conexão cai a cada 5 minutos nas salas do bloco C desde segunda-feira.",
    );
    await click(
      "//label[.//input[@name='priority'] and contains(normalize-space(), 'Alta')]",
    );
    const fileInput = await el("//input[@type='file']");
    await wd("POST", `/element/${fileInput}/value`, { text: attachPath });
    await waitText("print-erro.png");
    await click(button("Enviar chamado"));
    await waitUrl(/^\/chamados\/\d+/, 15000);
    ticketPath = (await url()).split("?")[0];
    await waitText("print-erro.png");
    await shot("03-chamado-usuario");
  });

  await step(
    "Gestor: login pelo portal, atribuir, mudar status, responder e nota interna",
    async () => {
      await logout();
      await login("/gestor/login", manager.email, manager.password);
      await waitUrl(/^\/gestor(?!\/login)/);
      await go(`/gestor${ticketPath}`);
      await waitText("Ações do Gestor");
      await click(`${field("Responsável")}/option[contains(., 'Ana Gestora')]`);
      await click(
        `${field("Status")}/option[normalize-space()='Em Andamento']`,
      );
      await click(button("Salvar alterações"));
      await waitFor(
        async () =>
          await js(
            "return [...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Salvar alterações').disabled",
          ),
        "salvar concluído",
      );
      await type(
        "//textarea[@placeholder='Responder ao solicitante...']",
        "Equipe de redes vai trocar o access point hoje à tarde.",
      );
      await click(
        "//textarea[@placeholder='Responder ao solicitante...']/following::button[normalize-space()='Enviar'][1]",
      );
      await waitText("Equipe de redes vai trocar");
      await type(
        "//textarea[@aria-label='Nova nota interna']",
        "NOTA-INTERNA-SECRETA: AP com defeito no rack 3",
      );
      await click(
        "//textarea[@aria-label='Nova nota interna']/following::button[normalize-space()='Salvar'][1]",
      );
      await waitText("NOTA-INTERNA-SECRETA");
      await shot("04-gestor-chamado");
    },
  );

  await step(
    "Usuário vê notificação e resposta, mas não a nota interna",
    async () => {
      await logout();
      await login("/login", user.email, user.password);
      await waitUrl(/^\/inicio/);
      await go("/notificacoes");
      await waitText("Wi-Fi do bloco C");
      await go(ticketPath);
      await waitText("Equipe de redes vai trocar");
      const text = await bodyText();
      if (text.includes("NOTA-INTERNA-SECRETA"))
        throw new Error("nota interna visível ao usuário!");
      if (!text.includes("Em Andamento"))
        throw new Error("status não atualizado");
    },
  );

  await step("Usuário fecha e reabre o chamado", async () => {
    await click(button("Fechar chamado"));
    await wd("POST", "/alert/accept", {});
    await waitText("Este chamado está fechado");
    await click(button("Reabrir"));
    await waitFor(
      async () => !(await bodyText()).includes("Este chamado está fechado"),
      "reaberto",
    );
  });

  await step(
    "Recuperação de senha por email (link real do Mailpit)",
    async () => {
      await logout();
      await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
      await go("/recuperar-senha");
      await type("//input[@name='email']", user.email);
      await click("//button[@type='submit']");
      const msg = await waitFor(async () => {
        const r = await fetch(`${MAILPIT}/api/v1/message/latest`);
        return r.ok ? r.json() : null;
      }, "email no Mailpit");
      const link = msg.Text.match(
        /https:\/\/[^/\s]+\/redefinir-senha\?token=[a-f0-9]{64}/,
      )[0];
      await go(link);
      user.password = "senha-trocada-456";
      await type(field("Nova senha"), user.password);
      await type(field("Confirme a nova senha"), user.password);
      await click("//button[@type='submit']");
      await waitText("Senha redefinida com sucesso!");
      await login("/login", user.email, user.password);
      await waitUrl(/^\/inicio/);
    },
  );

  await step("Perfil: exportar meus dados", async () => {
    await go("/perfil");
    await waitText("PRIVACIDADE E DADOS");
    const data = await wd("POST", "/execute/async", {
      script:
        "const done = arguments[0]; fetch('/api/v1/user/export').then(r => r.json()).then(done, e => done(String(e)));",
      args: [],
    });
    if (data.profile?.email !== user.email || data.tickets?.length !== 1)
      throw new Error("exportação incorreta");
    if (JSON.stringify(data).includes("NOTA-INTERNA-SECRETA"))
      throw new Error("nota interna na exportação!");
    await shot("05-perfil");
  });

  await step("Perfil: excluir conta (anonimização)", async () => {
    await click(button("Excluir minha conta"));
    await type(field("Confirme sua senha"), user.password);
    await click(button("Excluir definitivamente"));
    await waitUrl(/^\/\?conta=excluida/);
    await waitText("Sua conta foi excluída");
    await login("/login", user.email, user.password, { withCode: false });
    await waitText("Email/telefone ou senha incorretos");
  });

  await step("Gestor vê o chamado como 'Usuário removido'", async () => {
    await logout();
    await login("/gestor/login", manager.email, manager.password);
    await waitUrl(/^\/gestor(?!\/login)/);
    await go(`/gestor${ticketPath}`);
    await waitText("Usuário removido");
    if ((await bodyText()).includes(user.name))
      throw new Error("nome ainda aparece");
    for (const page of [
      "/gestor",
      "/gestor/fila",
      "/gestor/sla",
      "/gestor/equipe",
      "/gestor/configuracoes",
      "/gestor/notificacoes",
    ]) {
      await go(page);
      await waitFor(async () => (await url()).startsWith(page), page);
      if ((await bodyText()).includes(user.name))
        throw new Error(`nome aparece em ${page}`);
    }
    await shot("06-gestor-fila");
  });

  await step("Celular (390 px): sem rolagem horizontal", async () => {
    await wd("POST", "/window/rect", { width: 390, height: 844 });
    for (const page of ["/gestor", "/gestor/fila", "/gestor/perfil"]) {
      await go(page);
      await sleep(400);
      const overflow = await js(
        "return document.documentElement.scrollWidth - window.innerWidth",
      );
      if (overflow > 0) throw new Error(`${page} transborda ${overflow}px`);
    }
    await shot("07-mobile-perfil-gestor");
    await logout();
    for (const page of ["/", "/login", "/cadastro", "/privacidade"]) {
      await go(page);
      await sleep(400);
      const overflow = await js(
        "return document.documentElement.scrollWidth - window.innerWidth",
      );
      if (overflow > 0) throw new Error(`${page} transborda ${overflow}px`);
    }
    await go("/cadastro");
    await shot("08-mobile-cadastro");
  });
} finally {
  await wd("DELETE", "").catch(() => {});
  for (const r of results) console.log(r.join("  "));
  process.exitCode = results.some((r) => r[0] === "✗") ? 1 : 0;
}
