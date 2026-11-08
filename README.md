# CampusConnect

Plataforma de gerenciamento de chamados e solicitações de suporte acadêmico.
Usuários (alunos, professores, servidores) abrem e acompanham chamados; a
equipe de atendimento (agentes e gestores) gerencia a fila, atribui
responsáveis, controla prioridades e SLA e acompanha indicadores.

## Tecnologias

| Camada         | Tecnologia                                        |
| -------------- | ------------------------------------------------- |
| Front + API    | Next.js 16 (Pages Router) · React 19 · JavaScript |
| Estilo         | Tailwind CSS 4                                    |
| Banco de dados | PostgreSQL 18 (Docker) via `pg`                   |
| E-mail (dev)   | Mailpit (Docker) via `nodemailer`                 |
| Testes         | Jest (testes de integração contra a API real)     |
| Qualidade      | ESLint (`eslint-config-next`) · Prettier          |

## Pré-requisitos

- **Node.js ≥ 22.9** (recomendado: a versão do `.nvmrc`, Node 24 "Krypton")
- **Docker** com Docker Compose

> ⚠️ O Next.js 16 não roda no Node 18. Antes de qualquer comando, rode
> `nvm use` (ou `nvm install` se a versão não estiver instalada). Para tornar
> padrão: `nvm alias default 24`.

## Como executar

```bash
nvm use                # Node 24
npm install
npm run dev            # sobe Postgres + Mailpit, aplica migrations e inicia o Next
```

Em outro terminal, popule o banco com dados de demonstração:

```bash
npm run seed           # cria contas e chamados de exemplo (não duplica)
```

Acesse:

- Portal do usuário: http://localhost:3000
- Portal do gestor: http://localhost:3000/gestor/login
- Caixa de e-mails de desenvolvimento (Mailpit): http://localhost:8025

### Contas de demonstração

| Perfil  | Email                               | Senha         |
| ------- | ----------------------------------- | ------------- |
| Gestor  | `gestor@campusconnect.local`        | `Gestor@2026` |
| Agente  | `carlos.santos@campusconnect.local` | `Agente@2026` |
| Agente  | `maria.lima@campusconnect.local`    | `Agente@2026` |
| Usuário | `joao.silva@campusconnect.local`    | `Aluno@2026`  |
| Usuário | `juliana.reis@campusconnect.local`  | `Aluno@2026`  |

O usuário também pode entrar com o **telefone** cadastrado no lugar do email.

Depois da senha, o sistema envia um **código de 6 dígitos para o e-mail** da
conta (válido por 10 minutos, uso único, até 5 tentativas). Em desenvolvimento,
abra o código no Mailpit (http://localhost:8025). O cadastro também termina
com esse código, o que confirma que o e-mail pertence à pessoa.

### Cadastrar alguém da equipe (agente ou gestor)

O cadastro público cria só usuários comuns. Membros da equipe são criados por
um gestor:

1. Entre no portal do gestor com uma conta de **gestor**.
2. Menu **Equipe** → seção **Gerenciar Equipe**.
3. Preencha nome, e-mail, senha inicial e papel (**Agente** ou **Gestor**) e
   clique em **Adicionar**.
4. Passe a senha inicial à pessoa; ela entra em `/gestor/login` (recebendo o
   código no e-mail cadastrado) e pode trocar a senha em **Perfil**.

Na mesma tabela é possível mudar o papel ou desativar o acesso. O **primeiro**
gestor (quando ainda não existe nenhum) é criado pelo terminal com
`npm run manager:create` (ou `prod:manager:create` em produção).

## Scripts

| Comando                       | O que faz                                                           |
| ----------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                 | Sobe os serviços, aplica migrations e inicia o servidor de dev      |
| `npm run services:up`         | Sobe Postgres e Mailpit (`services:stop` / `services:down`)         |
| `npm run migrations:up`       | Aplica as migrations pendentes (`infra/migrations/*.sql`)           |
| `npm run seed`                | Cria contas, regras e chamados de demonstração                      |
| `npm run db:reset`            | **Apaga o banco** e recria tudo com os dados de demonstração        |
| `npm test`                    | Testes de integração (inicia o `next dev` se ele não estiver ativo) |
| `npm run lint:eslint`         | ESLint                                                              |
| `npm run lint:check`          | Prettier (`lint:fix` corrige)                                       |
| `npm run build`               | Build de produção                                                   |
| `npm run start:local`         | Servidor de produção usando as variáveis de `.env.development`      |
| `npm run manager:create`      | Cria um gestor (variáveis `MANAGER_*`; ver "Produção")              |
| `npm run maintenance:cleanup` | Remove sessões, tokens e registros de tentativas vencidos           |

> ⚠️ Os testes **apagam e recriam o banco local** a cada execução. Depois de
> rodar os testes, use `npm run db:reset` para restaurar os dados de demonstração.

## Estrutura

```
infra/            infraestrutura (banco, migrations, e-mail, erros, controller HTTP)
  migrations/     esquema SQL versionado
  scripts/        migrate, seed, wait-for-services, create-manager, cleanup
models/           regras de negócio e validações (usuário, sessão, chamado, SLA...)
lib/              código compartilhado com o navegador (rótulos, formatação, cliente da API)
components/       componentes de interface reutilizáveis
pages/            telas (getServerSideProps) e API (`pages/api/v1`)
test/             orquestrador e testes de integração
referencias_visuais/  telas de referência do design
```

Fluxo de uma requisição: **página/API → `infra/controller.js` (sessão,
permissão, erros) → `models/*` (validação + regra de negócio) → `infra/database.js`**.
As páginas carregam dados no servidor (`getServerSideProps`) chamando os
models diretamente; as ações (formulários e botões) usam a API REST.

## Segurança

- Senhas com hash **scrypt** (nativo do Node) e salt aleatório; nunca em texto puro.
- Sessão em cookie `HttpOnly` + `SameSite=Lax` (`Secure` em produção). O
  banco guarda apenas o **SHA-256** do token.
- Permissões verificadas **no servidor** em toda API e página: usuários só
  acessam os próprios chamados (chamados de terceiros retornam 404).
- APIs que alteram dados exigem JSON (bloqueia envio de formulários de outros sites).
- Recuperação de senha com token de uso único, válido por 60 minutos, que
  encerra todas as sessões; a resposta não revela se o email existe.
- Anexos: apenas PNG/JPG/PDF até 10 MB, validados pela assinatura do arquivo.
- Exportação CSV protegida contra injeção de fórmulas.
- **Limite de tentativas** (guardado no Postgres, com a chave em hash):
  10 falhas de login por conta e 100 por IP a cada 15 min; 3 pedidos de
  recuperação por email e 20 por IP por hora; 30 cadastros por IP por hora;
  10 erros de senha atual na troca de senha a cada 15 min. Resposta `429`
  com `Retry-After`. Os limites ficam em `models/rate-limit.js`.
- Trocar a senha pelo perfil encerra as sessões dos outros dispositivos.
- Cabeçalhos de segurança em todas as respostas (`next.config.mjs`): CSP,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`
  e HSTS (fora do modo dev).
- `/api/v1/status` público só informa se o banco está saudável; versão e
  conexões aparecem apenas para gestores.
- O `seed` (senhas públicas) e o `db:reset` se recusam a rodar fora de um banco local.

## Privacidade (LGPD)

- Página pública `/privacidade`, com os dados do controlador, do encarregado
  e a base legal vindos das variáveis `PRIVACY_*`. Enquanto faltar algum
  deles, a página exibe um aviso de "texto modelo".
- O cadastro exige o aceite da política e guarda a data e a versão do aceite
  (`lib/privacy.js`).
- Em **Meu Perfil → Privacidade e dados**: baixar os próprios dados (JSON) e
  excluir a conta.
- A exclusão é feita por **anonimização**: nome, email e telefone são apagados,
  sessões e notificações removidas, e os chamados ficam no histórico como
  "Usuário removido". Contas da equipe não se autoexcluem (um gestor as desativa).

## Produção (servidor com Docker)

A stack de produção fica em `infra/production/`:

| Serviço   | O que faz                                                                            |
| --------- | ------------------------------------------------------------------------------------ |
| `caddy`   | Proxy reverso com **HTTPS automático** (Let's Encrypt) e redirecionamento HTTP→HTTPS |
| `app`     | CampusConnect (`next start`), usuário não-root, sem porta exposta                    |
| `migrate` | Aplica as migrations e termina; o `app` só sobe depois dele                          |
| `db`      | PostgreSQL 18 **sem porta exposta**; a aplicação usa um usuário sem superusuário     |
| `backup`  | `pg_dump` diário em `infra/production/backups` (mantém 14 dias)                      |
| `cleanup` | Limpeza diária de sessões, tokens e registros de tentativas vencidos                 |

### Primeira instalação

1. Servidor Linux com Docker e as portas **80 e 443** abertas. Aponte o DNS do
   domínio (registro A/AAAA) para o IP do servidor.
2. Clone o projeto no servidor e crie a configuração:

   ```bash
   cp .env.production.example .env.production   # preencha TODOS os valores
   chmod 600 .env.production
   ```

3. Suba tudo (build da imagem, banco, migrations, app, HTTPS, backup e limpeza):

   ```bash
   npm run prod:up
   ```

4. Crie o primeiro gestor (nunca rode o `seed` em produção):

   ```bash
   MANAGER_NAME="Nome" MANAGER_EMAIL="gestor@faculdade.edu.br" \
   MANAGER_PASSWORD="senha-longa-e-unica" npm run prod:manager:create
   ```

   Os demais membros da equipe são criados por ele na tela **Equipe**.

5. Teste a recuperação de senha com um email real para validar o SMTP.

### Operação

| Comando                                         | O que faz                                       |
| ----------------------------------------------- | ----------------------------------------------- |
| `npm run prod:up`                               | Atualiza/sobe a stack (após `git pull`)         |
| `npm run prod:logs`                             | Acompanha os logs                               |
| `npm run prod:backup:now`                       | Backup imediato (ex.: antes de uma atualização) |
| `sh infra/production/restore.sh <arquivo.dump>` | Restaura um backup (pede confirmação)           |
| `npm run prod:down`                             | Para a stack (os dados ficam nos volumes)       |

> ⚠️ **Backups fora do servidor:** `infra/production/backups` fica no mesmo
> disco do banco. Copie essa pasta diariamente para outro lugar (outro
> servidor, storage da instituição, `rclone` para um bucket...). Sem isso,
> perder o servidor significa perder os dados.

### Testar a stack de produção localmente

Com `APP_DOMAIN=localhost`, o Caddy usa um certificado local (o navegador
avisa que não é confiável). Para testar o envio de emails sem SMTP real, use o
Mailpit de `test/e2e/compose.mailpit.yaml` (`EMAIL_SMTP_HOST=mailpit`,
`EMAIL_SMTP_PORT=1025`, `EMAIL_SMTP_SECURE=false`):

```bash
docker compose --env-file meu-teste.env -f infra/production/compose.yaml \
  -f test/e2e/compose.mailpit.yaml -p cc-prodtest up -d --build
geckodriver --port 4444 &
node test/e2e/production-flows.mjs /tmp/capturas "$PWD/algum-arquivo.png"
```

O roteiro E2E percorre no Firefox: cadastro com aceite da política, abertura de
chamado com anexo, atendimento pelo gestor (atribuição, status, resposta e nota
interna), notificações, fechar/reabrir, recuperação de senha pelo email,
exportação e exclusão da conta e telas em 390 px.

## Produção na Vercel

Alternativa à stack Docker. O que muda em relação ao servidor próprio:

| Item           | Na Vercel                                                                    |
| -------------- | ---------------------------------------------------------------------------- |
| Banco          | Postgres externo (ex.: Neon pela integração da Vercel), região São Paulo     |
| Região do app  | `gru1` (São Paulo), definida em `vercel.json`                                |
| Migrations     | Rodam no build de produção (`vercel-build`), pela conexão sem pooling        |
| Limpeza diária | Cron da Vercel → `/api/v1/maintenance/cleanup` (protegido por `CRON_SECRET`) |
| Anexos         | Máximo de **4 MB** (limite de 4,5 MB por requisição da Vercel)               |
| Backup         | Responsabilidade do provedor do banco: confira o plano (restauração)         |

### Passo a passo

1. Suba o código para o GitHub e importe o repositório na Vercel
   (Framework: Next.js). O build usa automaticamente o script `vercel-build`.
2. Em **Storage**, crie um banco **Neon** na região **São Paulo
   (sa-east-1)** e conecte ao projeto. Isso cria `DATABASE_URL` e
   `DATABASE_URL_UNPOOLED`.
3. Em **Settings → Environment Variables**, cadastre as variáveis de
   `.env.vercel.example` no ambiente **Production**. O build falha com uma
   mensagem clara se faltar alguma.
4. Faça o deploy. As migrations rodam antes do build. Deploys de preview não
   alteram o banco de produção.
5. Crie o primeiro gestor a partir do seu computador, apontando para o banco
   de produção (use a URL **sem** pooling e não salve a senha no histórico):
   ```bash
   DATABASE_URL="<DATABASE_URL_UNPOOLED>" MANAGER_NAME="Nome" \
   MANAGER_EMAIL="gestor@faculdade.edu.br" MANAGER_PASSWORD="senha-longa-e-unica" \
   node infra/scripts/create-manager.js
   ```
6. Em **Settings → Domains**, adicione o seu domínio e configure o DNS como a
   Vercel indicar. O HTTPS é automático. Depois, confirme que `APP_URL` é o
   endereço final e faça um novo deploy.
7. Teste em produção: cadastro (o código chega no e-mail?), login do
   gestor, abertura de chamado com anexo e recuperação de senha.

## Regras de negócio adotadas

Ver [`PROJECT_STATUS.md`](PROJECT_STATUS.md), seção "Decisões de negócio".
