# Arquitetura do AgendaFlow

## Visão geral

O produto será desenvolvido incrementalmente para um único negócio de serviços. A Fase 0 preparou a infraestrutura e os dados. A Fase 1 inclui cadastro/login e catálogo com persistência no PostgreSQL. O calendário permanece conceitual; operações reais de reserva pertencem às próximas especificações.

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
| `apps/api` | HTTP, autenticação, autorização, catálogo e regras transacionais | Confiar somente nas validações do navegador |
| `packages/shared` | Contratos e funções puras comuns | Importar Fastify, React, banco, `window` ou `document` |
| PostgreSQL | Persistência, integridade referencial e restrição de conflitos | Assumir regras de interface ou apresentação |

O verificador `scripts/arch-check.mjs` impede dependências básicas incompatíveis, mas não substitui testes ou revisão de código.

## Dados e concorrência

A migração `0001_initial.sql` cria entidades de usuários, serviços, profissionais, relações N:N, disponibilidade, bloqueios, agendamentos e auditoria. A extensão `btree_gist` permite um `EXCLUDE USING gist` que impede, para o mesmo profissional, intervalos `[início,fim)` sobrepostos em estados `PENDENTE` e `CONFIRMADO`.

O teste `db:verify` tenta inserir reservas concorrentes sobrepostas e exige o erro `23P01`; toda a transação é revertida. Validação de horário comercial, fuso, permissão e duração do serviço ainda precisa ser implementada nas fases seguintes.

## API da Fase 0

| Rota | Resposta | Dependência de PostgreSQL |
|---|---|---|
| `GET /api/v1/health` | `200 {status:"ok",service:"agendaflow-api",version:"0.1.0"}` | Não |
| `GET /api/v1/ready` | `200 {status:"ready"}` ou `503 {status:"unavailable"}` | Sim |

Na Fase 1 foram adicionados `/api/v1/auth/register`, `login`, `me`, `logout`, `/api/v1/services`, `/professionals` e consultas administrativas. Mutações exigem ADMIN, e o primeiro administrador é criado por comando local explícito. Ainda não existem endpoints de reserva.

## Evolução planejada

A cada funcionalidade: especificação `spec.md`, plano `plan.md`, tarefas `tasks.md`, testes, PR e CI. A próxima entrega contempla disponibilidade, pausas e bloqueios de horários. APIs serão organizadas por funcionalidade conforme o domínio ganhar comportamento, sem classes ou camadas fictícias antecipadas.

## Sessões e segurança (Fase 1)

A autenticação está isolada em `apps/api/src/modules/auth/`. O hash scrypt da senha é armazenado em `users.password_hash`; a tabela `sessions` armazena somente SHA-256 dos tokens opacos e a expiração. O navegador recebe um cookie HttpOnly com SameSite=Lax, Secure sob `NODE_ENV=production` e validade de sete dias. Logout invalida o hash no banco.

A função `requireAdmin` verifica a identidade na API, e não no frontend. Uma verificação de cabeçalho `Origin` bloqueia mutações de origem diferente. O rate limiting de login é local à instância e precisa de infraestrutura distribuída antes do deploy produtivo.

O módulo `apps/api/src/modules/catalog/` concentra as rotas públicas e administrativas. A tabela `professional_services` define quais serviços são executados por cada profissional, e atualizações de vínculos são transacionais.

Decisão de segurança: [ADR 0002](adr/0002-sessoes-opacas.md).
