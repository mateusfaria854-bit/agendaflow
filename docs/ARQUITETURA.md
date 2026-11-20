# Arquitetura do AgendaFlow

## Visão geral

O produto será desenvolvido incrementalmente para um único negócio de serviços. A Fase 0 preparou a infraestrutura e os dados. A Fase 1 inclui cadastro/login e catálogo com persistência no PostgreSQL. A Fase 2 implementa jornada semanal, bloqueios e cálculo de horários disponíveis no backend. A Fase 3 transforma esses slots em reservas confirmadas, com consulta e cancelamento pelo próprio cliente. A Fase 4 oferece o calendário administrativo com filtros, reserva manual e mudança auditada de status. Seu complemento adiciona consulta da própria agenda para contas PROFISSIONAL vinculadas a um cadastro ativo.

```text
React + TypeScript (apps/web)
       │ HTTP /api/v1
       ▼
Node.js + Fastify (apps/api)
       ├── application / domínio (futuro)
       ├── repositories (futuro)
       ▼
PostgreSQL 16
```

`packages/shared/` fornece tipos e funções puras utilizados pelos dois aplicativos.

## Estrutura

```text
agendaflow/
├── apps/
│   ├── web/                 React, TypeScript, Vite e CSS
│   └── api/                 Fastify, TypeScript, testes e SQL versionado
│       ├── src/db/          Pool, migração, seed e verificação
│       └── db/migrations/   Migrações do PostgreSQL
├── packages/
│   └── shared/              Tipos compartilhados e utilitários puros
├── specs/
│   ├── constitution.md     Princípios do produto
│   ├── 000-fundacao/       Spec, plano e tarefas
│   └── 001-autenticacao/   Próximo escopo
├── docs/
│   └── adr/                 Registros de decisões
├── scripts/                 Verificação SDD e fronteiras arquiteturais
├── compose.yaml             PostgreSQL apenas para desenvolvimento local
└── .github/workflows/ci.yml
```

## Fronteiras de responsabilidade

| Camada | Responsabilidade | Não deve fazer |
|---|---|---|
| `apps/web` | Componentes, estado visual, formulários e UX | Acessar banco diretamente ou decidir autorização |
| `apps/api` | HTTP, autenticação, catálogo, disponibilidade e regras transacionais | Confiar somente nas validações do navegador |
| `packages/shared` | Contratos e funções puras comuns | Importar Fastify, React, banco, `window` ou `document` |
| PostgreSQL | Persistência, integridade referencial e restrição de conflitos | Assumir regras de interface ou apresentação |

O verificador `scripts/arch-check.mjs` impede dependências básicas incompatíveis, mas não substitui testes ou revisão de código.

## Dados e concorrência

A migração `0001_initial.sql` cria entidades de usuários, serviços, profissionais, relações N:N, disponibilidade, bloqueios, agendamentos e auditoria. A extensão `btree_gist` permite um `EXCLUDE USING gist` que impede, para o mesmo profissional, intervalos `[início,fim)` sobrepostos em estados `PENDENTE` e `CONFIRMADO`.

O teste `db:verify` tenta inserir reservas concorrentes sobrepostas e exige o erro `23P01`; toda a transação é revertida. Validação de horário comercial, fuso, permissão e duração do serviço foi implementada nas Fases 2 e 3 e é reutilizada nas reservas administrativas da Fase 4.

## API da Fase 0

| Rota | Resposta | Dependência de PostgreSQL |
|---|---|---|
| `GET /api/v1/health` | `200 {status:"ok",service:"agendaflow-api",version:"0.1.0"}` | Não |
| `GET /api/v1/ready` | `200 {status:"ready"}` ou `503 {status:"unavailable"}` | Sim |

Na Fase 1 foram adicionados `/api/v1/auth/register`, `login`, `me`, `logout`, `/api/v1/services`, `/professionals` e consultas administrativas. Mutações exigem ADMIN, e o primeiro administrador é criado por comando local explícito. A Fase 2 adiciona `/api/v1/availability/slots` e rotas administrativas de jornada e bloqueios. A Fase 3 adiciona `POST /appointments`, `GET /appointments/mine` e `PATCH /appointments/:id/cancel`.

## Evolução planejada

A cada funcionalidade: especificação `spec.md`, plano `plan.md`, tarefas `tasks.md`, testes, PR e CI. A próxima entrega contempla a revisão de segurança, acessibilidade, testes ponta a ponta em navegador e publicação demonstrativa (Fase 5). APIs serão organizadas por funcionalidade conforme o domínio ganhar comportamento, sem classes ou camadas fictícias antecipadas.

## Sessões e segurança (Fase 1)

A autenticação está isolada em `apps/api/src/modules/auth/`. O hash scrypt da senha é armazenado em `users.password_hash`; a tabela `sessions` armazena somente SHA-256 dos tokens opacos e a expiração. O navegador recebe um cookie HttpOnly com SameSite=Lax, Secure sob `NODE_ENV=production` e validade de sete dias. Logout invalida o hash no banco.

A função `requireAdmin` verifica a identidade na API, e não no frontend. Uma verificação de cabeçalho `Origin` bloqueia mutações de origem diferente. O rate limiting de login é local à instância e precisa de infraestrutura distribuída antes do deploy produtivo.

O módulo `apps/api/src/modules/catalog/` concentra as rotas públicas e administrativas. A tabela `professional_services` define quais serviços são executados por cada profissional, e atualizações de vínculos são transacionais.

Decisão de segurança: [ADR 0002](adr/0002-sessoes-opacas.md).

## Agenda e bloqueios (Fase 2)

`apps/api/src/modules/availability/domain.ts` implementa uma função pura de geração de slots, percorrendo instantes UTC e convertendo para o fuso do negócio via Intl. Os slots são filtrados pela jornada semanal, duração do serviço, bloqueios e agendamentos PENDENTE/CONFIRMADO. O frontend é somente consumidor da API.

As rotas administrativas permitem substituir períodos de jornada (sem sobreposições) e registrar/remover bloqueios excepcionais, com verificação de autorização. Mudanças de expediente com reservas futuras são recusadas até a política de reagendamento da Fase 3.

**Fuso**: variável de ambiente `BUSINESS_TIMEZONE` com identificador IANA; padrão `America/Sao_Paulo`. As respostas usam timestamps ISO UTC e offset do horário local para desambiguar mudanças de horário de verão. Consulte [ADR 0003](adr/0003-disponibilidade-fuso.md).

## Reservas e consistência (Fase 3)

As rotas em `apps/api/src/modules/appointments/` exigem sessão CLIENTE. O POST aceita somente profissional, serviço e timestamp UTC de início. Preço, duração, término e status vêm da API e PostgreSQL.

A transação usa `FOR UPDATE` na linha do profissional, mesma trava utilizada na Fase 2 para editar expediente e bloqueios. Depois de adquirir a trava, recalcula os slots com as informações atualizadas, recusando início que não corresponda exatamente a um horário livre. O banco mantém a restrição EXCLUDE gist para impedir sobreposições de reservas ativas.

A listagem filtra por `client_id`, com até 50 reservas mais recentes. O cancelamento usa UPDATE condicional de status e data, preserva o histórico e recusa acesso de outro cliente com 404. Auditoria de criação e cancelamento é gravada na mesma transação. Consulte [ADR 0004](adr/0004-reservas-transacionais.md).

## Calendário e operação administrativa (Fase 4)

O módulo `apps/api/src/modules/admin/routes.ts` oferece listagem filtrada por período (máximo 31 dias civis no fuso do negócio), profissional e status, com paginação de 100 registros, totais e pesquisa controlada de clientes. Nome/e-mail do cliente são retornados exclusivamente sob autorização ADMIN.

`apps/api/src/modules/appointments/service.ts` centraliza o serviço de criação de reserva usado por clientes e administradores. Lock pessimista do profissional, consulta atualizada de slots e exclusão SQL continuam obrigatórios. Nenhuma rota pode informar preço ou duração pelo frontend.

Alterações de estado seguem PENDENTE → CONFIRMADO futuro, ativo → CANCELADO futuro, CONFIRMADO → CONCLUIDO após término. Mudança de status e registro em `audit_events` são atômicos. Veja o [ADR 0005](adr/0005-calendario-admin.md) e as especificações da [Fase 4](../specs/005-operacao-administrativa/spec.md).

## Área profissional (complemento da Fase 4)

O módulo `apps/api/src/modules/staff/routes.ts` exige papel PROFISSIONAL e deriva exclusivamente da sessão a identidade da agenda, por `professionals.user_id`. Os clientes e administradores não acessam essas rotas. Parâmetros como `professionalId` são rejeitados no endpoint de agenda profissional; um usuário só vê os próprios atendimentos.

O campo `professionals.user_id` já existe com restrição UNIQUE e chave estrangeira em `0001_initial.sql`. O comando `npm run staff:provision` usa `apps/api/src/modules/staff/provision.ts` para criar usuário PROFISSIONAL com senha scrypt, vinculá-lo e auditar a operação, tudo em uma única transação. O provisionamento exige nome, e-mail, senha e ID do profissional, sem senhas padrão. Contas existentes não são promovidas.

O frontend `StaffSchedule` é somente leitura, com filtros por período/status e paginação. A resposta inclui nome do cliente para identificação do atendimento, mas não inclui seu e-mail, preço ou informações de outros profissionais. Veja [ADR 0006](adr/0006-vinculo-profissional.md).
