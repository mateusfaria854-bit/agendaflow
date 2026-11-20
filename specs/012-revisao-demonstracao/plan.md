# Plano técnico · Revisão de interface

Alterar somente conteúdo estático do React nos componentes `App.tsx` e `Portal.tsx`. Preservar estados internos, assinaturas das APIs e comportamento da seção de agendamento. Ajustar a descrição das etapas concluídas e o rótulo visual da etapa final para refletir que a demonstração está publicada.

Adicionar verificação de conteúdo com Playwright em `tests/e2e/booking.spec.ts`, incluindo resposta de saúde da API renderizada no rodapé e distinção explícita de dados fictícios. Manter execução sobre PostgreSQL descartável no CI, jamais sobre o banco hospedado.

Atualizar o roadmap técnico com o marco de revisão final, preservando pendências operacionais: snapshots nativos do volume, observação do cron e retenção do S3 sem exclusões automáticas.
