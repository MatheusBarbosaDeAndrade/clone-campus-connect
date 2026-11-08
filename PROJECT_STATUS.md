# CampusConnect — Status do Projeto

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluída e testada · `[!]` bloqueada

Última atualização: 08/11/2026

## Etapa 1 — Estabilização e fundação

- [x] Node fixado (`engines >= 22.9`, `.nvmrc` = Node 24). O Next 16 não roda no Node 18 do sistema.
- [x] Postgres trocado de `19rc1` (release candidate) para a versão estável `18.6-alpine3.24`.
- [x] `infra/database.js`: pool de conexões (antes, uma conexão por consulta e sem `try/finally`, o que vazava conexões em caso de erro), transações e erro 503 quando o banco está fora.
- [x] `/api/v1/status` com dados reais do banco (versão, conexões); remoção do `console.log` de depuração.
- [x] Migrations SQL versionadas (`infra/migrations`), aplicadas uma única vez com trava (advisory lock).
- [x] Orquestrador de testes: espera os serviços, limpa o banco e roda as migrations; o `next dev` sobe automaticamente nos testes.
- [x] ESLint (flat config `eslint-config-next`) e Prettier.
- [x] Tailwind CSS 4; layout base (sidebar do usuário e do console, telas de autenticação divididas), componentes reutilizáveis, página 404.
- [x] Mailpit no `compose.yaml`, para os e-mails de recuperação de senha em desenvolvimento.

## Etapa 2 — Autenticação

- [x] Boas-vindas, cadastro (nome, telefone, email, senha) com validação no cliente e no servidor.
- [x] Login por **email ou telefone**, opção "Lembrar-me" (30 dias; sem ela, a sessão dura até fechar o navegador ou no máximo 12 h).
- [x] Verificação em duas etapas por e-mail: após a senha (e ao final do cadastro), código de 6 dígitos válido por 10 min, de uso único, com até 5 tentativas; pedir outro código invalida o anterior; no máximo 5 códigos por conta a cada 15 min.
- [x] Logout (sessão removida do banco); o usuário volta à página de boas-vindas. Login e cadastro têm "Voltar à página inicial".
- [x] Recuperação de senha por e-mail (token de uso único válido por 60 min, que encerra as sessões antigas).
- [x] Portal do gestor: usuários comuns não entram pelo login do gestor.
- [x] Proteção de páginas e APIs por papel (`user`, `agent`, `manager`).

## Etapa 3 — Chamados (usuário)

- [x] Abertura com assunto, categoria, descrição, prioridade e anexos.
- [x] Meus Chamados: busca (texto ou `#número`), filtro por status e ordenação.
- [x] Detalhe: dados, anexos, linha do tempo, mensagens, fechar e reabrir.
- [x] Dashboard com contadores e chamados recentes reais.
- [x] Isolamento: o chamado de outro usuário retorna 404 (página e API).

## Etapa 4 — Console de gestão

- [x] Painel geral: indicadores, abertos por setor e por prioridade, atividade recente.
- [x] Fila: cards, abas (Todos, Não atribuídos, Críticos, Vencendo SLA), busca, filtro por setor e exportação CSV.
- [x] Detalhe: atribuir responsável, alterar prioridade e status, "Assumir chamado", escalar, notas internas e mensagens com o solicitante.
- [x] Equipe: carga por agente, TMR, distribuição por prioridade, resolvidos por dia (7 dias), tempo da primeira resposta, taxa de reabertura, cadastro de membros, troca de papel e ativar/desativar.

## Etapa 5 — Complementares

- [x] Notificações geradas por eventos (status, atribuição, mensagens, escalonamento, novo chamado sem responsável); marcar uma ou todas como lidas; contador na sidebar.
- [x] Perfil: nome, telefone e troca de senha (exige a senha atual). Disponível para usuários e para a equipe.
- [x] SLA: prazo calculado por prioridade, recálculo ao mudar a prioridade, reinício ao reabrir, lista de risco (< 1 h), taxa de cumprimento e tempo médio de resolução.
- [x] Configurações (somente gestor): atribuição automática (liga/desliga e regras por categoria), CRUD de categorias (exclusão lógica) e edição dos prazos de SLA.

## Etapa 6 — Finalização

- [x] 91 testes de integração passando (API, permissões, isolamento, e-mail, anexos e proteção das páginas).
- [x] `eslint .` sem erros/avisos · `prettier --check .` ok · `next build` ok.
- [x] Conferência visual em navegador real (Firefox headless) das telas em desktop e celular (390 px).
- [x] Fluxos principais percorridos em navegador real contra a stack de produção (roteiro E2E automatizado).

## Etapa 7 — Preparação para produção

- [x] Limite de tentativas (login, cadastro, recuperação e troca de senha), com resposta 429.
- [x] Troca de senha encerra as sessões dos outros dispositivos.
- [x] Cabeçalhos de segurança (CSP, anti-clickjacking, HSTS etc.) em `next.config.mjs`.
- [x] `/api/v1/status` sem detalhes do banco para o público.
- [x] Script `manager:create` para o primeiro gestor; `seed`/`db:reset` bloqueados fora do banco local.
- [x] Scripts `prod:*` (migrations, gestor, limpeza) e `.env.production.example`.
- [x] Limpeza de sessões, tokens e tentativas vencidos (`maintenance:cleanup`).
- [x] Portas do Docker de desenvolvimento ligadas só em `127.0.0.1`.
- [x] Stack de produção para VPS com Docker (`infra/production/`): HTTPS automático (Caddy), banco sem porta exposta e com usuário sem superusuário, migrations antes do app, backup diário e limpeza diária.
- [x] `TRUST_PROXY` validado atrás do Caddy: IP forjado em `X-Forwarded-For` não escapa do limite e outro IP não é afetado.
- [x] Backup e restauração testados de ponta a ponta (`restore.sh`).
- [x] LGPD: página `/privacidade`, aceite obrigatório no cadastro (data + versão), exportação dos dados e exclusão por anonimização.
- [x] Roteiro E2E em navegador real (Firefox) contra a stack de produção: 11/11 fluxos ok (`test/e2e/production-flows.mjs`).
- [x] Preparado para a Vercel: conexão por `DATABASE_URL` (com pooling) e SSL, região `gru1`, migrations no build de produção, limpeza via Cron protegido por `CRON_SECRET`, anexos limitados a 4 MB (configurável) e validação das variáveis no build.
- [ ] **Instituição:** revisar o texto de `/privacidade` e definir controlador, contato do DPO e base legal (`PRIVACY_*`).
- [ ] **Implantação:** servidor, domínio apontando para ele, conta SMTP real e cópia diária dos backups para fora do servidor.

## Testes executados

| Verificação                 | Resultado                                      |
| --------------------------- | ---------------------------------------------- |
| `npm test` (Jest, 8 suítes) | 91/91 passando                                 |
| `npm run lint:eslint`       | sem problemas                                  |
| `npm run lint:check`        | ok                                             |
| `npm run build`             | ok (43 rotas)                                  |
| Capturas em produção        | 16 telas conferidas com `referencias_visuais/` |

## Decisões de negócio adotadas (sem documento oficial; confirmar com o orientador)

1. **Prioridades:** Baixa, Média, Alta e **Crítica** em todo o sistema. As referências misturavam "Urgente" e "Crítica".
2. **SLA:** prazos da tela de configurações (Crítica 2 h, Alta 8 h, Média 24 h, Baixa 72 h), em **horas corridas**, editáveis pelo gestor. Mudar a prioridade recalcula o prazo a partir da abertura; reabrir reinicia o prazo. O SLA **não pausa** em "Aguardando Resposta".
3. **Status:** Aberto, Em Análise, Em Andamento, Aguardando Resposta, Fechado e Reaberto. No dashboard do usuário, "Em Atendimento" agrupa Em Análise, Em Andamento e Aguardando.
4. **Campo "Assunto"** adicionado ao novo chamado, porque as listas exibem um título.
5. **Papéis:** usuário (abre chamados), agente (atende chamados no console) e gestor (agente + configurações + gestão da equipe). Agentes e gestores entram pelo portal do gestor. Só usuários comuns abrem chamados.
6. **Fechar e reabrir:** o solicitante pode fechar o próprio chamado a qualquer momento e reabrir sem prazo limite. Chamado fechado não aceita novas mensagens até ser reaberto.
7. **Escalar:** eleva a prioridade em um nível (se já for Crítica, mantém) e notifica gestores e responsável.
8. **Atribuição automática:** desativada por padrão; quando ativa, vale a regra ativa mais antiga da categoria.
9. **Anexos:** PNG, JPG e PDF de até 10 MB cada (4 MB na Vercel, por limite da plataforma), no máximo 10 por chamado, guardados no próprio Postgres (`bytea`).
10. **Status Online/Ausente/Offline da equipe:** derivado da última atividade (< 5 min = online, < 30 min = ausente).
11. **Exclusão de conta (LGPD):** anonimização (definido pelo autor em 08/11/2026). Nome, email e telefone são apagados; os chamados permanecem como "Usuário removido". Só usuários comuns se autoexcluem; a equipe é desativada por um gestor.

## Removido das referências (seria apenas decorativo)

- Login com Google, SSO institucional, MFA por aplicativo e verificação de telefone por SMS: exigem serviços externos (a verificação em duas etapas é feita por código no e-mail).
- "Mesclar chamado" e CSAT (satisfação): não há fluxo de avaliação nas telas do usuário.
- Avisos gerais (ex.: "Manutenção programada"): as notificações tratam só de chamados.
- "Abrir novo chamado" no console: só usuários comuns abrem chamados.
- Aba "Roteamento" e "Filtros Avançados": sem regra definida.
- Matrícula e vínculo no dashboard: o cadastro das referências não coleta esses dados.

## Limitações conhecidas / próximos passos

- [ ] Escalonamento automático por tempo sem interação (as referências citam "4 horas") precisa de um job agendado e de uma regra definida.
- [ ] Os e-mails de produção dependem de um SMTP real (variáveis `EMAIL_*`).
- [ ] Os testes usam o mesmo banco do desenvolvimento; depois deles, rode `npm run db:reset`.

## Roteiro de demonstração

1. `npm run dev` e, em outro terminal, `npm run db:reset`.
2. Cadastro de um novo usuário → abrir chamado com anexo → ver no dashboard.
3. Entrar como gestor → fila → abrir o chamado → atribuir, mudar prioridade e status, escrever nota interna e resposta.
4. Voltar como usuário → ver notificações, linha do tempo e mensagem → fechar e reabrir.
5. Console: SLA (escalar), Equipe, Configurações (ativar a atribuição automática e abrir um chamado da categoria da regra).
6. Recuperar senha → abrir o link recebido no Mailpit (http://localhost:8025).
7. Todo login pede o código enviado ao e-mail: veja-o no Mailpit.
