# Plano técnico: Fase 0

## Arquitetura
- Npm workspaces: `apps/web`, `apps/api` e `packages/shared`.
- React/Vite compila prévia visual, com proxy local de `/api` para o backend.
- API Fastify expõe health e readiness; fábrica `createApp` permite teste sem porta nem banco.
- Contratos TypeScript e função pura de interseção de intervalos ficam em `shared`.
- CI usa Node.js 22 e PostgreSQL 16.

## Dados
Migração `0001_initial.sql` inclui usuários, serviços, profissionais, vínculo N:N, disponibilidades, bloqueios, agendamentos e auditoria. O banco usa `btree_gist` e `EXCLUDE ... tstzrange` para impedir sobreposição de agendamentos PENDENTE/CONFIRMADO do mesmo profissional. Seed fictício com UUIDs estáveis, transações e `ON CONFLICT DO NOTHING`. Migração idempotente é registrada em `schema_migrations`.

## Riscos
- Mudanças no modelo exigem nova migração, não edição de migração já aplicada.
- Mesmo com restrição temporal, serviço, jornada, autorização e fuso precisarão ser validados em regras de aplicação nas fases seguintes.
- Configuração Docker contém somente credenciais locais ilustrativas, nunca destinadas a produção.
- Sem API de negócio, a prévia de calendário não pode gravar reservas.

## Testes
`npm run check` executa specs, arquitetura, build e testes. CI sobe PostgreSQL e executa migração, seed e verificação de conflito em transação revertida.
