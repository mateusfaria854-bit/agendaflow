# Roadmap do AgendaFlow

Projeto incremental para um único negócio de serviços. O cronograma é definido por dependências e critérios de aceite, não por prazos artificiais.

| Fase | Entrega | Critério principal |
|---|---|---|
| 0 | Fundação técnica | Workspaces, React, Fastify, PostgreSQL, migrations, seed, SDD e CI validados |
| 1 | Identidade e catálogo | Cadastro/login, sessões, controle ADMIN e catálogo com testes |
| 2 | Disponibilidade | Jornada, pausas, bloqueios e slots válidos calculados no servidor |
| 3 | Reservas | Criar, listar, cancelar e impedir conflitos simultâneos no banco |
| 4 | Operação administrativa | Calendário, reservas manuais, gestão de status e agenda pessoal de profissionais vinculados |
| 5 | Qualidade e publicação | E2E desktop/mobile, acessibilidade, segurança HTTP e demo HTTPS Railway verificada externamente; operação/segurança de produção ainda pendentes |
| Pós-MVP | Reagendamento, relatórios e notificações | Critérios de aceite próprios após MVP validado |

O PDF de planejamento foi organizado em 17 páginas, com jornadas, dados, endpoints indicativos e regras de negócio. A implementação segue as especificações versionadas em `specs/`.

## Segurança e privacidade
Dados de demonstração são sempre sintéticos. O sistema não realiza pagamentos e não possui integração WhatsApp obrigatória no MVP.

## Contribuição
Novas funcionalidades devem ter especificação, plano e tarefas antes do código. Mudanças de escopo precisam atualizar os testes e a documentação relacionada.

**Fase 1:** implementada. **Fase 2:** expediente semanal, pausas, bloqueios e cálculo de horários disponíveis. **Fase 3:** criação, consulta e cancelamento de reservas reais, com revalidação transacional e concorrência protegida. **Fase 4:** calendário administrativo, reservas manuais, pesquisa de clientes, transições auditadas e painel privado do profissional. **Fase 5 demonstrativa concluída:** testes desktop/mobile, acessibilidade básica, segurança HTTP, imagem Docker, frontend/API em mesma origem e deploy na Railway com PostgreSQL. **Validado em 20/11/2026:** URL HTTPS, DNS/TLS, interface, endpoints de saúde e prontidão do banco, por GitHub Actions executado externamente. **Monitoramento:** workflow de disponibilidade agendado a cada 6 horas. **Pendente antes de usar dados reais:** proteção contra abuso distribuído, política automatizada de retenção/limpeza, backups e restauração testados, alertas e métricas operacionais, recuperação de senha e revisão LGPD.
