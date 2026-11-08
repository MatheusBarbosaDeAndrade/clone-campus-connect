import pg from "pg";
import { ServiceError } from "./errors.js";

const { Pool } = pg;

// Códigos de erro do Postgres/node que indicam indisponibilidade do banco
// (e não erro de consulta).
const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "57P03", // cannot_connect_now (banco iniciando)
]);

// Duas formas de configurar a conexão:
// - DATABASE_URL (Vercel + Neon/Supabase etc.): URL completa do provedor.
//   Na Vercel, use a URL *com pooling* (PgBouncer), pois cada instância da
//   função abre o próprio pool. SSL é obrigatório nesses provedores.
// - POSTGRES_HOST/PORT/USER/DB/PASSWORD: desenvolvimento e stack Docker.
// POSTGRES_POOL_MAX limita as conexões por instância (padrão 10; na Vercel, 3).
function createPool() {
  const common = {
    max: Number(process.env.POSTGRES_POOL_MAX) || 10,
    connectionTimeoutMillis: 5000,
    // Em serverless, a instância pode ser congelada: não segurar conexões ociosas.
    idleTimeoutMillis: process.env.VERCEL ? 5000 : 10000,
  };
  if (process.env.DATABASE_URL) {
    return new Pool({
      ...common,
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.POSTGRES_SSL === "false" ? false : true,
    });
  }
  return new Pool({
    ...common,
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === "true",
  });
}

// Em desenvolvimento o Next recarrega módulos (HMR); guardar o pool no
// globalThis evita abrir um novo pool a cada recarga.
function getPool() {
  if (!globalThis.__campusConnectPool) {
    globalThis.__campusConnectPool = createPool();
  }
  return globalThis.__campusConnectPool;
}

function wrapError(error) {
  if (CONNECTION_ERROR_CODES.has(error.code)) {
    return new ServiceError({
      message: "Não foi possível conectar ao banco de dados.",
      cause: error,
    });
  }
  return error;
}

async function query(queryObject, params) {
  try {
    return await getPool().query(queryObject, params);
  } catch (error) {
    throw wrapError(error);
  }
}

async function getNewClient() {
  try {
    return await getPool().connect();
  } catch (error) {
    throw wrapError(error);
  }
}

// Executa `callback(client)` dentro de uma transação. Qualquer erro faz
// ROLLBACK e é repassado ao chamador.
async function transaction(callback) {
  const client = await getNewClient();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw wrapError(error);
  } finally {
    client.release();
  }
}

async function end() {
  if (globalThis.__campusConnectPool) {
    const pool = globalThis.__campusConnectPool;
    globalThis.__campusConnectPool = undefined;
    await pool.end();
  }
}

const database = { query, getNewClient, transaction, end };

export default database;
