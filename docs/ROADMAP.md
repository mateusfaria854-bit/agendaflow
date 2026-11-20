# Roadmap do AgendaFlow

Projeto incremental para um único negócio de serviços. O cronograma é definido por dependências e critérios de aceite, não por prazos artificiais.

| Fase | Entrega | Critério principal |
|---|---|---|
| 0 | Fundação técnica | Workspaces, React, Fastify, PostgreSQL, migrations, seed, SDD e CI validados |
| 1 | Identidade e catálogo | Cadastro/login, sessões, controle ADMIN e catálogo com testes |
| 2 | Disponibilidade | Jornada, pausas, bloqueios e slots válidos calculados no servidor |
| 3 | Reservas | Criar, listar, cancelar e impedir conflitos simultâneos no banco |
| 4 | Operação administrativa | Calendário, reservas manuais, gestão de status e agenda pessoal de profissionais vinculados |
| 5 | Qualidade e publicação | E2E desktop/mobile, acessibilidade, segurança HTTP e preparação de deploy; implantação externa ainda pendente |
| Pós-MVP | Reagendamento, relatórios e notificações | Critérios de aceite próprios após MVP validado |

O PDF de planejamento foi organizado em 17 páginas, com jornadas, dados, endpoints indicativos e regras de negócio. A implementação segue as especificações versionadas em `specs/`.

## Segurança e privacidade
Dados de demonstração são sempre sintéticos. O sistema não realiza pagamentos e não possui integração WhatsApp obrigatória no MVP.

## Contribuição
Novas funcionalidades devem ter especificação, plano e tarefas antes do código. Mudanças de escopo precisam atualizar os testes e a documentação relacionada.

**Fase 1:** implementada. **Fase 2:** expediente semanal, pausas, bloqueios e cálculo de horários disponíveis. **Fase 3:** criação, consulta e cancelamento de reservas reais, com revalidação transacional e concorrência protegida. **Fase 4:** calendário administrativo, reservas manuais, pesquisa de clientes, transições auditadas e painel privado do profissional. **Fase 5 em andamento:** testes de navegador desktop/mobile, acessibilidade e segurança HTTP; preparação de deploy/backup/rollback documentada. **Pendente:** hospedagem externa, revisão operacional/monitoramento e validação em ambiente público.
