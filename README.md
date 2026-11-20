# AgendaFlow

[![Qualidade e banco](https://github.com/mateusfaria854-bit/agendaflow/actions/workflows/ci.yml/badge.svg)](https://github.com/mateusfaria854-bit/agendaflow/actions/workflows/ci.yml)

**Plataforma full-stack de agendamentos** em desenvolvimento, com React, TypeScript, Node.js, Fastify e PostgreSQL. O projeto segue **Spec-Driven Development (SDD)** e prioriza uma arquitetura clara, requisitos verificáveis e prevenção de reservas duplicadas.

> **Estado atual: Fase 4, com área profissional.** Clientes podem reservar e cancelar, administradores podem operar a agenda e **profissionais autenticados consultam somente seus próprios atendimentos**. Cada profissional precisa de uma conta vinculada explicitamente, sem cadastro público nesse papel. A Fase 5 ainda contempla testes E2E, segurança, acessibilidade e deploy demonstrativo.

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
  004-agendamentos/    Reserva, listagem e cancelamento transacionais
  005-operacao-administrativa/ Calendário e gestão administrativa
  006-area-profissional/       Complemento de acesso por profissional
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

## Funcionalidades implementadas

- **Cadastro e login:** clientes criam conta; senhas usam scrypt e salt aleatório.
- **Sessões:** cookies HttpOnly/SameSite, hashes dos tokens no PostgreSQL, logout e expiração.
- **Permissões:** endpoints de escrita do catálogo exigem administrador; cadastro público nunca cria admin.
- **Catálogo:** listagem pública de serviços e profissionais ativos.
- **Painel administrativo:** criação, edição, desativação e vínculo de profissionais a serviços.
- **Disponibilidade (Fase 2):** expediente semanal com pausas, bloqueios excepcionais e consulta pública de horários livres, respeitando reservas ativas e duração do serviço.
- **Agendamentos (Fase 3):** reservar um slot disponível, consultar até 50 reservas próprias e cancelar as futuras; proteção contra conflitos, preço definido pelo servidor e auditoria no PostgreSQL.
- **Calendário administrativo (Fase 4):** listar atendimentos por período, profissional e status, paginação e totais, pesquisar contas de clientes, criar reservas manuais e alterar estados com regras de transição.
- **Área profissional (complemento da Fase 4):** acesso pessoal à própria agenda, filtros de data/status, paginação e proteção contra consulta de outros profissionais, sem e-mail de cliente ou dados financeiros.

O primeiro administrador é criado pelo comando local `npm run admin:create`; uma conta profissional é provisionada com `npm run staff:provision` e vinculada a um profissional previamente cadastrado. Nenhum desses comandos possui credenciais padrão. Consulte o [Guia local](docs/GUIA_LOCAL.md) para configurar as variáveis temporárias e usar o painel. **O sistema já permite agendamentos reais no ambiente local, sem integração de pagamentos ou envio de notificações.**

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
| POST | `/api/v1/appointments` | CLIENTE, confirmar reserva |
| GET | `/api/v1/appointments/mine` | CLIENTE, somente próprias reservas |
| PATCH | `/api/v1/appointments/:id/cancel` | CLIENTE titular, cancelar reserva futura |
| GET | `/api/v1/admin/appointments?from=&to=&professionalId=&status=&offset=` | ADMIN, agenda filtrada, até 100 por página |
| GET | `/api/v1/admin/clients?query=` | ADMIN, pesquisa de clientes existentes |
| POST | `/api/v1/admin/appointments` | ADMIN, reserva manual com as mesmas regras do cliente |
| PATCH | `/api/v1/admin/appointments/:id/status` | ADMIN, transições autorizadas e auditadas |
| GET | `/api/v1/staff/me` | PROFISSIONAL com conta vinculada e cadastro ativo |
| GET | `/api/v1/staff/appointments?from=&to=&status=&offset=` | PROFISSIONAL, somente própria agenda |

### Como testar o calendário administrativo

1. Inicie o PostgreSQL, a API e o frontend conforme o [guia local](docs/GUIA_LOCAL.md).
2. Entre com uma conta ADMIN criada via `npm run admin:create`.
3. No painel, abra **Calendário de atendimentos** e filtre por datas (até 31 dias), profissional e status.
4. Em **Agendar para um cliente**, pesquise um CLIENTE cadastrado, escolha serviço/profissional/data e confirme um horário disponível.
5. Use **Cancelar** em reservas futuras e **Concluir** somente após o término do atendimento. A interface acompanha as restrições da API.

A pesquisa de clientes e a lista de reservas são acessíveis apenas ao administrador. **Não há pagamentos, e-mails automáticos, deploy de produção nem testes E2E em navegador nesta fase.**

### Como habilitar a área profissional

1. Cadastre um profissional no painel ADMIN e copie o **ID para provisionar conta** exibido abaixo do nome.
2. Configure temporariamente `PROFESSIONAL_ID`, `STAFF_NAME`, `STAFF_EMAIL` e `STAFF_PASSWORD` no terminal. A senha precisa ter entre 12 e 128 caracteres.
3. Execute `npm run staff:provision`. Esse comando cria uma conta PROFISSIONAL exclusiva e a associa à agenda; não converte nem promove contas existentes.
4. Entre com essa conta no site. O painel **Sua agenda profissional** permite consultar somente os seus próprios atendimentos por período e status.

Veja os comandos PowerShell e os cuidados com credenciais no [Guia local](docs/GUIA_LOCAL.md). A agenda do profissional é **somente leitura**. Ações administrativas continuam restritas ao ADMIN.

## Testes e verificações

```bash
npm run check
npm run db:migrate
npm run db:seed
npm run db:verify
```

A CI executa build, testes, verificações arquiteturais, migrações e integração real com PostgreSQL, incluindo autenticação, controle de acesso, catálogo, reserva concorrente, agenda administrativa, isolamento da agenda profissional, filtros e transições de status. O seed é idempotente.

## Processo SDD

Cada funcionalidade tem três documentos versionados em `specs/NNN-nome/`: `spec.md` (requisitos e aceite), `plan.md` (arquitetura e dados), e `tasks.md` (execução e testes). O conjunto de princípios está em [specs/constitution.md](specs/constitution.md).

Especificações implementadas: [Fundação](specs/000-fundacao/spec.md), [Autenticação](specs/001-autenticacao/spec.md), [Catálogo](specs/002-catalogo/spec.md), [Disponibilidade](specs/003-disponibilidade/spec.md), [Agendamentos](specs/004-agendamentos/spec.md) e [Operação administrativa](specs/005-operacao-administrativa/spec.md), incluindo o [complemento de área profissional](specs/006-area-profissional/spec.md). A próxima fase é a revisão de segurança, acessibilidade, testes E2E e publicação demonstrativa.

## Próximas fases

Confira o [Roadmap](docs/ROADMAP.md) e as [Issues planejadas](https://github.com/mateusfaria854-bit/agendaflow/issues). O planejamento contempla identidade, catálogo de serviços e profissionais, disponibilidade, criação de reservas, operação administrativa e publicação.

## Segurança e escopo

O frontend não acessa o banco diretamente. A API verifica autenticação e permissões administrativas; reservas do cliente e reservas manuais passam pelo mesmo serviço transacional. O calendário administrativo só devolve informações administrativas aos administradores; a agenda do profissional consulta apenas agendamentos vinculados à própria sessão, sem e-mail do cliente ou valores. Mudanças de status obedecem uma máquina de estados com auditoria. O PostgreSQL impede sobreposição de reservas `PENDENTE` e `CONFIRMADO`. O cancelamento preserva o histórico e libera o horário. Pagamentos e notificações ainda não estão implementados.

Não são utilizadas credenciais de produção ou dados reais. Os valores em `compose.yaml` são apenas para desenvolvimento local.

## Autoria

**Mateus Faria Andrade** · Engenharia de Software, UniRV

[GitHub](https://github.com/mateusfaria854-bit) · [Arquitetura](docs/ARQUITETURA.md) · [Decisões técnicas](docs/adr/0001-monorepo-e-postgresql.md)
