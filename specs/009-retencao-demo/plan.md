# Plano técnico · Retenção da demo

## Arquitetura

Um comando CLI de manutenção isolado reutiliza o pool PostgreSQL do backend. O padrão é uma prévia de somente leitura. A opção `--execute` só opera com `DEMO_MODE=true` e `DEMO_MAINTENANCE_ENABLED=true`.

## Seleção, integridade e segurança

A elegibilidade exige cliente fictício, idade mínima de 30 dias desde a criação e desde a última atividade registrada em login/logout, inexistência de agendamentos recentes/futuros, sessões ativas/recentes ou auditoria recente. A exclusão é transacional, com lotes pequenos, trava consultiva e `FOR UPDATE SKIP LOCKED`. As chaves estrangeiras são respeitadas: auditoria, sessões e reservas saem antes da conta.

## Operação

Sem agendamento por padrão. O operador deve validar backup específico da Railway e realizar restauração segura antes de ativar qualquer execução real periódica. Contagens são exibidas sem informações pessoais.

A migração 0003 preserva todas as contas existentes por pelo menos mais 30 dias a partir da migração, evitando expurgo imediato de contas antigas.
