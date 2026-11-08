// Cria contas e chamados de demonstração para apresentar o sistema.
// Uso: npm run seed      (pode ser executado mais de uma vez: não duplica dados)
//      npm run db:reset  (APAGA todo o banco e recria com os dados de demonstração)
import database from "../database.js";
import { runPendingMigrations } from "../migrator.js";
import category from "../../models/category.js";
import settings from "../../models/settings.js";
import ticket from "../../models/ticket.js";
import user from "../../models/user.js";
import assignmentRule from "../../models/assignment-rule.js";

const ACCOUNTS = [
  {
    name: "Ana Gestora",
    email: "gestor@campusconnect.local",
    password: "Gestor@2026",
    role: "manager",
  },
  {
    name: "Carlos Santos",
    email: "carlos.santos@campusconnect.local",
    password: "Agente@2026",
    role: "agent",
  },
  {
    name: "Maria Lima",
    email: "maria.lima@campusconnect.local",
    password: "Agente@2026",
    role: "agent",
  },
  {
    name: "Pedro Alves",
    email: "pedro.alves@campusconnect.local",
    password: "Agente@2026",
    role: "agent",
  },
  {
    name: "João Silva",
    email: "joao.silva@campusconnect.local",
    password: "Aluno@2026",
    role: "user",
    phone: "11999999999",
  },
  {
    name: "Juliana Reis",
    email: "juliana.reis@campusconnect.local",
    password: "Aluno@2026",
    role: "user",
    phone: "11988888888",
  },
];

async function ensureAccount(account) {
  const existing = await user.findByEmail(account.email);
  if (existing) return existing;
  return user.create(account);
}

async function seedTickets(people) {
  const count = await database.query(
    "SELECT count(*)::int AS total FROM tickets;",
  );
  if (count.rows[0].total > 0) {
    console.log(
      "• Já existem chamados no banco; chamados de demonstração não foram criados.",
    );
    return;
  }
  const categories = await category.listActive();
  const byName = (name) => categories.find((c) => c.name === name).id;
  const { manager, carlos, maria, joao, juliana } = people;

  const t1 = await ticket.create(joao, {
    title: "Biblioteca - Reclamação multa indevida",
    description:
      "O livro foi devolvido no prazo, porém o sistema registrou atraso e gerou multa.",
    categoryId: byName("Biblioteca"),
    priority: "baixa",
  });
  await ticket.updateByStaff(t1.id, manager, {
    assigneeId: maria.id,
    status: "em_analise",
  });
  await ticket.addMessage(t1.id, maria, {
    body: "Verificamos o registro e a multa será removida em até 24h.",
  });
  await ticket.updateByStaff(t1.id, maria, { status: "fechado" });
  await ticket.updateStatusByRequester(t1.id, joao, "reaberto");
  await ticket.addMessage(t1.id, joao, {
    body: "A multa ainda aparece no meu cadastro.",
  });

  const t2 = await ticket.create(joao, {
    title: "Solicitação de troca de turma - Turma C",
    description:
      "Gostaria de formalizar o pedido de transferência de turno para a Turma C (noturno).",
    categoryId: byName("Secretaria"),
    priority: "media",
  });
  await ticket.updateByStaff(t2.id, manager, {
    assigneeId: maria.id,
    status: "em_andamento",
  });
  await ticket.addMessage(t2.id, maria, {
    body: "Transferência aprovada pela coordenação.",
  });
  await ticket.updateByStaff(t2.id, maria, { status: "fechado" });

  const t3 = await ticket.create(joao, {
    title: "Problema de acesso ao portal acadêmico",
    description:
      "Mensagem de erro de credenciais inválidas ao tentar entrar no portal, mesmo com a senha correta.",
    categoryId: byName("TI / Sistemas"),
    priority: "alta",
  });
  await ticket.updateByStaff(t3.id, manager, { assigneeId: carlos.id });

  const t4 = await ticket.create(joao, {
    title: "Ar condicionado quebrado na sala 204B",
    description:
      "O ar condicionado da sala 204B está fazendo um barulho extremamente alto e não está resfriando o ambiente. Os alunos estão com dificuldade de concentração.",
    categoryId: byName("Infraestrutura"),
    priority: "alta",
  });
  await ticket.updateByStaff(t4.id, manager, {
    assigneeId: carlos.id,
    status: "em_analise",
  });
  await ticket.addMessage(t4.id, manager, {
    body: "Equipe de plantão escalada para verificar o compressor.",
    internal: true,
  });
  await ticket.addMessage(t4.id, carlos, {
    body: "Uma equipe de manutenção foi escalada para verificar o compressor do ar condicionado ainda hoje à tarde.",
  });

  await ticket.create(juliana, {
    title: "Queda de energia no bloco central de TI",
    description:
      "Laboratórios estão sem rede de dados e sistemas inoperantes desde o início da manhã.",
    categoryId: byName("Infraestrutura"),
    priority: "critica",
  });

  const t6 = await ticket.create(juliana, {
    title: "Boleto da mensalidade com valor incorreto",
    description:
      "O boleto de novembro veio com valor diferente do contrato, sem o desconto de pontualidade.",
    categoryId: byName("Financeiro"),
    priority: "media",
  });
  await ticket.updateByStaff(t6.id, manager, {
    assigneeId: maria.id,
    status: "aguardando",
  });
  await ticket.addMessage(t6.id, maria, {
    body: "Pode nos enviar o comprovante do último pagamento?",
  });

  console.log("✓ Chamados de demonstração criados.");
}

// Trava de segurança: o seed cria contas com senhas públicas (estão no
// README) e o --reset apaga o banco inteiro. Só roda em banco local, a não
// ser que ALLOW_DEMO_SEED=true seja definido de propósito.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const isLocalDatabase = LOCAL_HOSTS.has(process.env.POSTGRES_HOST);
if (
  process.env.ALLOW_DEMO_SEED !== "true" &&
  (process.env.NODE_ENV === "production" || !isLocalDatabase)
) {
  console.error(
    "✗ Seed bloqueado: ele cria contas com senhas públicas e o --reset apaga o banco.\n" +
      "  Só é permitido em banco local. Em produção, crie o gestor com `npm run manager:create`.",
  );
  process.exit(1);
}

try {
  if (process.argv.includes("--reset")) {
    await database.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    console.log("✓ Banco de dados apagado.");
  }
  await runPendingMigrations();
  const created = {};
  for (const account of ACCOUNTS) {
    created[account.email] = await ensureAccount(account);
  }
  const people = {
    manager: created["gestor@campusconnect.local"],
    carlos: created["carlos.santos@campusconnect.local"],
    maria: created["maria.lima@campusconnect.local"],
    joao: created["joao.silva@campusconnect.local"],
    juliana: created["juliana.reis@campusconnect.local"],
  };
  console.log("✓ Contas de demonstração prontas.");

  const rules = await assignmentRule.list();
  if (rules.length === 0) {
    const categories = await category.listActive();
    const id = (name) => categories.find((c) => c.name === name)?.id;
    await assignmentRule.create({
      name: "Redes & Acesso",
      categoryId: id("TI / Sistemas"),
      agentId: people.carlos.id,
    });
    await assignmentRule.create({
      name: "Diários Acadêmicos",
      categoryId: id("Acadêmico"),
      agentId: people.maria.id,
    });
    await settings.set("auto_assign_enabled", false);
    console.log(
      "✓ Regras de atribuição de exemplo criadas (atribuição automática desativada).",
    );
  }

  await seedTickets(people);

  console.log("\nAcessos de demonstração:");
  console.log(
    "  Gestor:  gestor@campusconnect.local / Gestor@2026  (http://localhost:3000/gestor/login)",
  );
  console.log("  Agente:  carlos.santos@campusconnect.local / Agente@2026");
  console.log(
    "  Usuário: joao.silva@campusconnect.local / Aluno@2026  (http://localhost:3000/login)",
  );
} catch (error) {
  console.error("✗ Erro no seed:", error);
  process.exitCode = 1;
} finally {
  await database.end();
}
