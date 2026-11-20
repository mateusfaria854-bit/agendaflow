# Plano técnico: Área profissional

## Arquitetura
- apps/api/src/modules/staff/routes.ts: duas rotas de consulta, autorização por sessão e escopo derivado de professionals.user_id.
- apps/api/src/modules/staff/provision.ts: serviço de criação de conta e vínculo usando transação PostgreSQL.
- apps/api/src/db/provision-staff.ts: entrada CLI por variáveis temporárias STAFF_NAME, STAFF_EMAIL, STAFF_PASSWORD e PROFESSIONAL_ID.
- apps/web/src/features/staff/StaffSchedule.tsx: painel para papel PROFISSIONAL, com filtros e paginação.
- O Portal React exibe StaffSchedule somente com role PROFISSIONAL; nenhuma mudança de reserva é disponibilizada nessa tela.

## Persistência
A migração 0001_initial.sql já contém professionals.user_id UUID UNIQUE REFERENCES users(id). A conta é criada no papel PROFISSIONAL via scrypt e vinculada à linha de profissional bloqueada FOR UPDATE na mesma transação, com audit_events. Nenhuma migração nova é necessária.

O comando staff:provision requer ID de um profissional previamente cadastrado. Um e-mail já cadastrado ou profissional já vinculado falha explicitamente, sem reaproveitar ou promover contas CLIENTE, ADMIN ou outras contas PROFISSIONAL.

## API
- GET /api/v1/staff/me: { professional: {id,name} }.
- GET /api/v1/staff/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&status=CONFIRMADO&offset=0: {professional,timezone,from,to,offset,pageSize,total,appointments}.
- O ID é sempre identificado pelo cookie e pela associação no banco. Não há professionalId em parâmetros.
- Paginação de 100 registros, até 31 dias civis por consulta, baseada no fuso de negócio.
- Campos da lista: id, startsAt, endsAt, status, serviceName, clientName. Sem e-mail, preço ou identidade do cliente.

## Segurança e limitações
- Um profissional inativo ou não vinculado não acessa sua agenda.
- A listagem pública de profissionais não inclui hasAccount. Essa informação é restrita ao endpoint admin.
- Provisionamento somente local, com senha forte preenchida temporariamente, sem segredo padrão ou variável gravada no repositório.
- Administração da conta, convite por e-mail e autoatendimento ficam para evolução futura. A aplicação ainda precisa de revisão de segurança e E2E em navegador na Fase 5.

## Testes
Teste integrado PostgreSQL: provisão, duplicatas, rollback, role, associação, filtragem por status, privacidade, acesso cruzado, filtros inválidos, perfil desativado, autenticação e autorização. CI mantém a regressão das fases anteriores.
