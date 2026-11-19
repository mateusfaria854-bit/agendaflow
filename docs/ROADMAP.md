# Roadmap do AgendaFlow

Projeto incremental para um único negócio de serviços. O cronograma é definido por dependências e critérios de aceite, não por prazos artificiais.

| Fase | Entrega | Critério principal |
|---|---|---|
| 0 | Fundação técnica | Workspaces, React, Fastify, PostgreSQL, migrations, seed, SDD e CI validados |
| 1 | Identidade e catálogo | Cadastro/login seguros, papéis, serviços e profissionais testados |
| 2 | Disponibilidade | Jornada, pausas, bloqueios e slots válidos calculados no servidor |
| 3 | Reservas | Criar, listar, cancelar e impedir conflitos simultâneos no banco |
| 4 | Operação administrativa | Calendário, reservas manuais e transições de status autorizadas |
| 5 | Polimento e publicação | Acessibilidade, E2E, observabilidade e deploy demonstrativo |
| Pós-MVP | Reagendamento, relatórios e notificações | Critérios de aceite próprios após MVP validado |

O PDF de planejamento foi organizado em 17 páginas, com jornadas, dados, endpoints indicativos e regras de negócio. A implementação segue as especificações versionadas em `specs/`.

## Segurança e privacidade
Dados de demonstração são sempre sintéticos. O sistema não realiza pagamentos e não possui integração WhatsApp obrigatória no MVP.

## Contribuição
Novas funcionalidades devem ter especificação, plano e tarefas antes do código. Mudanças de escopo precisam atualizar os testes e a documentação relacionada.
