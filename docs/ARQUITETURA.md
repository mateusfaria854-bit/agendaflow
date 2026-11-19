# Arquitetura do AgendaFlow

## Visão geral

O produto será desenvolvido incrementalmente para um único negócio de serviços. A Fase 0 disponibiliza somente uma prévia do frontend e uma API de monitoramento. As operações reais de autenticação, catálogo e reservas pertencem às próximas especificações.

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
| `apps/api` | HTTP, validação, autenticação futura e regras transacionais | Confiar somente nas validações do navegador |
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

Ainda não existem endpoints de cadastro, serviços ou reservas. Não há autenticação funcional nesta fase.

## Evolução planejada

A cada funcionalidade: especificação `spec.md`, plano `plan.md`, tarefas `tasks.md`, testes, PR e CI. A próxima entrega contempla autenticação e perfis. APIs serão organizadas por funcionalidade conforme o domínio ganhar comportamento, sem classes ou camadas fictícias antecipadas.
