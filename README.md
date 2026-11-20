# AgendaFlow

[![Qualidade e banco](https://github.com/mateusfaria854-bit/agendaflow/actions/workflows/ci.yml/badge.svg)](https://github.com/mateusfaria854-bit/agendaflow/actions/workflows/ci.yml)

**Plataforma full-stack de agendamentos** em desenvolvimento, com React, TypeScript, Node.js, Fastify e PostgreSQL. O projeto segue **Spec-Driven Development (SDD)** e prioriza uma arquitetura clara, requisitos verificáveis e prevenção de reservas duplicadas.

> **Estado atual: Fase 2, disponibilidade.** Além de cadastro/login e catálogo com PostgreSQL, a API calcula horários livres por jornada, duração, bloqueios e reservas ativas. A tela permite consultar horários e administrar expedientes, mas **a criação de reservas reais ainda não está disponível** (Fase 3).

## Objetivo

Organizar serviços, profissionais e horários para um único negócio de atendimentos. O MVP permitirá reservar, consultar e cancelar agendamentos, com validação de conflito no backend e no PostgreSQL. Nesta etapa já é possível cadastrar usuários e administrar serviços e profissionais.

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
  001-autenticacao/     Autenticação e perfis
  002-catalogo/        Gestão de serviços e profissionais
  003-disponibilidade/ Horários, jornada e bloqueios
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

## Funcionalidades da Fase 1

- **Cadastro e login:** clientes criam conta; senhas usam scrypt e salt aleatório.
- **Sessões:** cookies HttpOnly/SameSite, hashes dos tokens no PostgreSQL, logout e expiração.
- **Permissões:** endpoints de escrita do catálogo exigem administrador; cadastro público nunca cria admin.
- **Catálogo:** listagem pública de serviços e profissionais ativos.
- **Painel administrativo:** criação, edição, desativação e vínculo de profissionais a serviços.
- **Disponibilidade (Fase 2):** expediente semanal com pausas, bloqueios excepcionais e consulta pública de horários livres, respeitando reservas ativas e duração do serviço.

O primeiro administrador é criado pelo comando local `npm run admin:create`, sem credenciais de demonstração publicadas. Consulte o [Guia local](docs/GUIA_LOCAL.md) para configurar as variáveis temporárias e usar o painel. **O sistema ainda não possui reservas reais.**

### Endpoints atuais

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/v1/auth/register` | Público, cadastra CLIENTE |
| POST | `/api/v1/auth/login` | Público |
| GET | `/api/v1/auth/me` | Sessão válida |
| POST | `/api/v1/auth/logout` | Sessão ou visitante |
| GET | `/api/v1/services`, `/api/v1/professionals` | Público |
| GET | `/api/v1/admin/services`, `/api/v1/admin/professionals` | Admin |
| POST/PATCH | `/api/v1/services`, `/api/v1/professionals` | Admin |
| GET | `/api/v1/availability/slots` | Público, horários disponíveis |
| GET | `/api/v1/admin/availability` | Admin, expediente/bloqueios |
| PUT | `/api/v1/admin/professionals/:id/availability` | Admin, definir expediente |
| POST/DELETE | `/api/v1/admin/blocked-periods[/id]` | Admin, bloquear e liberar períodos |

## Testes e verificações

```bash
npm run check
npm run db:migrate
npm run db:seed
npm run db:verify
```

A CI executa build, testes, verificações arquiteturais, migrações e testes reais no PostgreSQL, incluindo autenticação, controle de acesso, catálogo e a rejeição de duas reservas ativas sobrepostas do mesmo profissional. O seed é idempotente.

## Processo SDD

Cada funcionalidade tem três documentos versionados em `specs/NNN-nome/`: `spec.md` (requisitos e aceite), `plan.md` (arquitetura e dados), e `tasks.md` (execução e testes). O conjunto de princípios está em [specs/constitution.md](specs/constitution.md).

Especificações implementadas: [Fundação](specs/000-fundacao/spec.md), [Autenticação](specs/001-autenticacao/spec.md), [Catálogo](specs/002-catalogo/spec.md) e [Disponibilidade](specs/003-disponibilidade/spec.md). A próxima etapa é reservar, listar e cancelar agendamentos reais.

## Próximas fases

Confira o [Roadmap](docs/ROADMAP.md) e as [Issues planejadas](https://github.com/mateusfaria854-bit/agendaflow/issues). O planejamento contempla identidade, catálogo de serviços e profissionais, disponibilidade, criação de reservas, operação administrativa e publicação.

## Segurança e escopo

O frontend não acessa o banco diretamente. A API já verifica autenticação, permissões administrativas e validações do catálogo; a criação de reservas reais continua fora do escopo. O PostgreSQL já possui a restrição para impedir sobreposição de reservas `PENDENTE` e `CONFIRMADO`; o restante das regras de negócio ainda será implementado.

Não são utilizadas credenciais de produção ou dados reais. Os valores em `compose.yaml` são apenas para desenvolvimento local.

## Autoria

**Mateus Faria Andrade** · Engenharia de Software, UniRV

[GitHub](https://github.com/mateusfaria854-bit) · [Arquitetura](docs/ARQUITETURA.md) · [Decisões técnicas](docs/adr/0001-monorepo-e-postgresql.md)
