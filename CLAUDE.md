# AgendaFlow

Fluxo de engenharia: consultar `AGENTS.md`, `specs/constitution.md` e a especificação relevante antes de implementar mudanças.

Ordem de trabalho: contexto e requisitos → plano técnico → tarefas → código e testes → validação em CI.

Comandos: `npm run spec:check`, `npm run arch:check`, `npm run build`, `npm test`; a integração do banco é validada com `npm run db:migrate`, `npm run db:seed` e `npm run db:verify`.

Na Fase 0, o frontend apresenta uma prévia conceitual. Não criar fluxos fictícios de reserva nem simular autenticação como se estivesse pronta.
