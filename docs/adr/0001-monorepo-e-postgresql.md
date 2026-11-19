# ADR 0001: Monorepo simples e PostgreSQL como fonte da integridade

- **Status:** Aceita
- **Data:** 2026-11-19
- **Contexto:** um projeto de portfólio full-stack, com frontend, backend, dados e especificações versionadas. O domínio de reservas exige prevenção de conflitos em chamadas concorrentes.

## Decisão
- Npm workspaces com `apps/web`, `apps/api`, `packages/shared` e sem orquestrador adicional.
- React e TypeScript no frontend, Fastify e TypeScript na API e PostgreSQL 16 na persistência.
- Migrações SQL explícitas, rastreadas por `schema_migrations`.
- Restrição `EXCLUDE` para intervalos de agendamentos ativos do mesmo profissional.
- Seed determinístico e fictício; CI executa verificação de concorrência e reverte transações de teste.

## Alternativas consideradas
- Múltiplos repositórios: mais configuração sem ganho no escopo inicial.
- Orquestradores de monorepo adicionais: complexidade prematura.
- Validar sobreposição só no frontend: inseguro diante de duas requisições simultâneas.

## Consequências
A estrutura separa responsabilidades e permite testar API e domínio de modo independente. PostgreSQL requer ambiente local ou contêiner CI. Regras específicas de negócio, autorização, cálculo de horários e envio de notificações continuam pendentes das respectivas specs.
