# Plano técnico: disponibilidade

## Arquitetura
- `apps/api/src/modules/availability/domain.ts` calcula slots como função pura; sem dependências SQL/Fastify.
- `routes.ts` carrega jornada, bloqueios, agendamentos ativos e vínculo serviço/profissional do PostgreSQL, valida autenticação para mutações e aplica regras de domínio.
- `apps/web/src/features/availability/` inclui consulta pública e edição de jornada/bloqueios no painel do admin.
- Requests usam `/api/v1`, mantendo cookie HttpOnly e autorização backend da Fase 1.

## Algoritmo de horários
- Jornada semanal usa weekday JS 0–6, início/fim HH:MM e períodos disjuntos, sem atravessar a meia-noite.
- O servidor percorre instantes UTC em passos de 15 minutos em uma janela que cobre integralmente o dia civil do negócio em qualquer offset usual.
- `Intl.DateTimeFormat` transforma cada instante em data/hora local da zona IANA. Isso evita inventar instantes na hora pulada do DST. Intervalos que atravessam uma transição de offset não são oferecidos.
- Apenas inícios no dia desejado, dentro do expediente e cujo fim local esteja antes do fechamento são mantidos.
- O algoritmo elimina colisões com bloqueios e reservas ativas usando semântica `[start,end)`.
- Respostas incluem `startsAt`, `endsAt` UTC, `label` HH:MM local e `offset` para horários ambíguos na volta do relógio.

## APIs
- `GET /api/v1/availability/slots?serviceId=&professionalId=&date=YYYY-MM-DD` público.
- `GET /api/v1/admin/availability?professionalId=` admin.
- `PUT /api/v1/admin/professionals/:id/availability` admin, substitui `windows` transacionalmente.
- `POST /api/v1/admin/blocked-periods` admin, cria bloqueio.
- `DELETE /api/v1/admin/blocked-periods/:id` admin, remove bloqueio.

## Persistência e riscos
As tabelas `availabilities`, `blocked_periods` e `appointments` já foram criadas na migração inicial. O seed de segunda a sexta, com pausa de almoço, é preservado. Não há migração nova.

Operações administrativas bloqueiam a linha do profissional durante escrita. A criação do bloqueio recusa sobreposição com bloqueios existentes e agendamentos ativos; a alteração da agenda é recusada se existirem reservas futuras ativas. O endpoint de criação de reservas da Fase 3 precisará usar estratégia compatível para evitar condições de corrida.

O produto usa `BUSINESS_TIMEZONE=America/Sao_Paulo` por padrão, configurável como fuso IANA. Datas de bloqueio são transmitidas com offset explícito. O formulário HTML `datetime-local` usa o horário do dispositivo do administrador, mostrado como observação na UI; negócios em fusos distintos devem ajustar o ambiente ou adotar seletor de zona dedicado.

## Testes
Testes unitários com datas determinísticas, duração, pausa, bloqueios, reservas, datas inválidas e DST. Integração com Postgres no CI exercita GET, PUT, POST, DELETE, papéis 401/403 e rejeição 409. Regressões da Fase 1 e da restrição SQL permanecem.
