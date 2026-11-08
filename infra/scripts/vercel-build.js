// Comando de build na Vercel (script "vercel-build" do package.json).
// 1. Confere a configuração obrigatória e falha o deploy se faltar algo.
// 2. Em deploys de PRODUÇÃO, aplica as migrations pendentes antes do build,
//    usando a conexão SEM pooling (o PgBouncer em modo transação não
//    suporta a trava pg_advisory_lock usada pelo migrator).
//    Previews não tocam no banco de produção.
// 3. Roda `next build`.
import { spawnSync } from "node:child_process";

const isProduction = process.env.VERCEL_ENV === "production";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (isProduction) {
  const required = [
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "APP_URL",
    "EMAIL_SMTP_HOST",
    "EMAIL_SMTP_PORT",
    "EMAIL_FROM",
    "CRON_SECRET",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    fail(`Variáveis de ambiente faltando na Vercel: ${missing.join(", ")}`);
  }
  if (!process.env.APP_URL.startsWith("https://")) {
    fail(
      "APP_URL deve começar com https:// (ex.: https://chamados.seudominio.com.br).",
    );
  }
  if (process.env.TRUST_PROXY !== "true") {
    fail(
      "Defina TRUST_PROXY=true (o IP real do cliente vem do proxy da Vercel).",
    );
  }
  if (process.env.CRON_SECRET.length < 16) {
    fail("CRON_SECRET deve ter pelo menos 16 caracteres.");
  }
}

// A Vercel recusa requisições/respostas de função acima de 4,5 MB.
const maxMb = Number(process.env.NEXT_PUBLIC_ATTACHMENT_MAX_MB);
if (!(maxMb > 0 && maxMb <= 4)) {
  fail(
    "Na Vercel, defina NEXT_PUBLIC_ATTACHMENT_MAX_MB com no máximo 4 (limite de 4,5 MB por requisição).",
  );
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isProduction) {
  console.log("→ Aplicando migrations no banco de produção...");
  run(process.execPath, ["infra/scripts/migrate.js"], {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL_UNPOOLED,
    POSTGRES_POOL_MAX: "1",
  });
} else {
  console.log(
    `→ Deploy "${process.env.VERCEL_ENV || "local"}": migrations ignoradas.`,
  );
}

run(process.execPath, ["node_modules/next/dist/bin/next", "build"]);
