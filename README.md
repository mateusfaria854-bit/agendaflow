# AgendaFlow

[![Qualidade e banco](https://github.com/mateusfaria854-bit/agendaflow/actions/workflows/ci.yml/badge.svg)](https://github.com/mateusfaria854-bit/agendaflow/actions/workflows/ci.yml)

**Plataforma full-stack de agendamentos** em desenvolvimento, com React, TypeScript, Node.js, Fastify e PostgreSQL. O projeto segue **Spec-Driven Development (SDD)** e prioriza uma arquitetura clara, requisitos verificáveis e prevenção de reservas duplicadas.

> **Estado atual: Fase 0, fundação técnica.** O frontend apresenta uma prévia conceitual. Login, serviços e agendamentos reais ainda não estão disponíveis. O banco contém exclusivamente seeds fictícios.

## Objetivo

Organizar serviços, profissionais e horários para um único negócio de atendimentos. O MVP permitirá reservar, consultar e cancelar agendamentos, com validação de conflito no backend e no PostgreSQL.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, CSS |
| Backend | Node.js 22, Fastify 5, TypeScript |
| Banco | PostgreSQL 16, migrações SQL e dados fictícios |
| Organização | Npm workspaces, contratos compartilhados, SDD, ADRs |
| Qualidade | Node Test Runner, testes de API, testes transacionais do banco, GitHub Actions |

## Organização do repositório

```text
apps/
  web/                  Interface React
  api/                  API Fastify e migrações PostgreSQL
packages/
  shared/               Contratos e funções puras
specs/
  constitution.md       Princípios de desenvolvimento
  000-fundacao/         Requisitos, plano e tarefas da Fase 0
  001-autenticacao/     Planejamento da Fase 1
  _templates/           Modelos de spec, plan e tasks
docs/
  ARQUITETURA.md        Limites e fluxo entre camadas
  GUIA_LOCAL.md         Instalação e execução
  ROADMAP.md            Fases do MVP
  adr/                  Decisões arquiteturais
scripts/                Verificação SDD e de dependências
.github/workflows/      CI
compose.yaml            PostgreSQL local
```

## Instalação

Pré-requisitos: **Node.js 22+**, npm e Docker Compose.

```bash
npm install
cp apps/api/.env.example apps/api/.env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run db:verify
```

No Windows PowerShell, utilize `Copy-Item apps/api/.env.example apps/api/.env`.

Inicie a API e a interface em terminais separados:

```bash
npm run dev:api
npm run dev:web
```

- Interface: **http://127.0.0.1:5173**
- API: **http://127.0.0.1:3333/api/v1/health**

Instruções detalhadas: [Guia local](docs/GUIA_LOCAL.md).

## Testes e verificações

```bash
npm run check
npm run db:migrate
npm run db:seed
npm run db:verify
```

A CI executa build, testes, verificações arquiteturais, migrações e um teste real no PostgreSQL: duas reservas ativas sobrepostas do mesmo profissional não podem ser gravadas. O seed é idempotente.

## Processo SDD

Cada funcionalidade tem três documentos versionados em `specs/NNN-nome/`: `spec.md` (requisitos e aceite), `plan.md` (arquitetura e dados), e `tasks.md` (execução e testes). O conjunto de princípios está em [specs/constitution.md](specs/constitution.md).

A especificação vigente é [Fase 0](specs/000-fundacao/spec.md). A próxima etapa será [Autenticação e perfis](specs/001-autenticacao/spec.md).

## Próximas fases

Confira o [Roadmap](docs/ROADMAP.md). O planejamento contempla identidade, catálogo de serviços e profissionais, disponibilidade, criação de reservas, operação administrativa e publicação.

## Segurança e escopo

O frontend não acessa o banco diretamente. A API é responsável pela autorização e validações críticas nas próximas fases. O PostgreSQL já possui a restrição para impedir sobreposição de reservas `PENDENTE` e `CONFIRMADO`; o restante das regras de negócio ainda será implementado.

Não são utilizadas credenciais de produção ou dados reais. Os valores em `compose.yaml` são apenas para desenvolvimento local.

## Autoria

**Mateus Faria Andrade** · Engenharia de Software, UniRV

[GitHub](https://github.com/mateusfaria854-bit) · [Arquitetura](docs/ARQUITETURA.md) · [Decisões técnicas](docs/adr/0001-monorepo-e-postgresql.md)
