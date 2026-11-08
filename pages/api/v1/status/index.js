import database from "infra/database.js";
import { createHandler, getSessionUser } from "infra/controller.js";

// Público: informa apenas se a aplicação e o banco estão respondendo (usado
// por monitores de disponibilidade). Detalhes internos do banco (versão,
// conexões) só aparecem para gestores autenticados.
async function getHandler(request, response) {
  const updatedAt = new Date().toISOString();
  await database.query("SELECT 1;");

  const viewer = await getSessionUser(request);
  if (viewer?.role !== "manager") {
    response.status(200).json({
      updated_at: updatedAt,
      dependencies: { database: { status: "healthy" } },
    });
    return;
  }

  const [version, maxConnections, openedConnections] = await Promise.all([
    database.query("SHOW server_version;"),
    database.query("SHOW max_connections;"),
    database.query({
      text: "SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname = $1;",
      values: [process.env.POSTGRES_DB],
    }),
  ]);

  response.status(200).json({
    updated_at: updatedAt,
    dependencies: {
      database: {
        status: "healthy",
        version: version.rows[0].server_version,
        max_connections: Number(maxConnections.rows[0].max_connections),
        opened_connections: openedConnections.rows[0].total,
      },
    },
  });
}

export default createHandler({ GET: getHandler });
