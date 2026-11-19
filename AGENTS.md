# Padrões de engenharia do AgendaFlow

## Fonte de verdade
- `specs/constitution.md` define limites do produto e decisões gerais.
- Cada funcionalidade nasce em `specs/NNN-nome/`, com `spec.md`, `plan.md` e `tasks.md`.
- `docs/ARQUITETURA.md` apresenta as fronteiras entre camadas.
- `docs/adr/` registra decisões arquiteturais relevantes.

## Limites de responsabilidade
- `apps/web/`: apresentação, formulários e experiência. Não acessa PostgreSQL.
- `apps/api/`: rotas HTTP, regras do servidor e persistência.
- `packages/shared/`: contratos e funções puras; sem dependência de React, Fastify ou banco.
- Regras de autorização, disponibilidade, fuso e reserva precisam ser validadas no backend.
- Reservas concorrentes são protegidas também no PostgreSQL.

## Fluxo de trabalho
1. Definir cenários verificáveis em `spec.md` antes de alterar funcionalidades.
2. Especificar contratos, dados, riscos e limites em `plan.md`.
3. Decompor em `tasks.md` com testes e critérios de pronto.
4. Implementar uma alteração pequena por vez, com testes de regressão.
5. Executar `npm run check` e, quando aplicável, migração e `db:verify`.
6. Abrir PR com evidências dos testes. Não publicar dados reais.

## Cuidados
- Não criar APIs de autenticação sem especificação e testes de segurança.
- Não usar credenciais reais, nem inserir dados pessoais de terceiros em seed ou demonstração.
- Não apresentar recursos de roadmap como funcionalidades já entregues.
