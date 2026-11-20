# Fase 4: Operação administrativa do calendário

## Contexto
O AgendaFlow já permite reservas pelo cliente. Agora o administrador precisa localizar atendimentos, operar a agenda, criar reservas para contas existentes e gerenciar status, sem ignorar as regras de disponibilidade ou revelar dados a outros papéis.

## Requisitos
- RF-401: Apenas ADMIN lista atendimentos por período, profissional e status, em fuso IANA configurado para o negócio.
- RF-402: O período consultado tem no máximo 31 dias civis e a API oferece paginação de 100 itens, limite de deslocamento de 10.000 registros e contagem por status.
- RF-403: A listagem inclui serviço, profissional, nome e e-mail do cliente somente para ADMIN, nunca retornando hash de senha, tokens ou dados de outras entidades.
- RF-404: ADMIN pesquisa contas CLIENTE existentes por nome/e-mail a partir de três caracteres, retornando até 15 resultados. Profissional, cliente e visitante não têm acesso.
- RF-405: ADMIN agenda manualmente para cliente existente selecionando serviço, profissional e início UTC fornecido pela disponibilidade. Preço, duração, status e autorização vêm do backend.
- RF-406: Reserva manual usa o mesmo serviço de aplicação e lock de profissional da reserva do cliente, com proteção PostgreSQL contra dupla reserva.
- RF-407: ADMIN pode confirmar apenas PENDENTE futuro, cancelar apenas PENDENTE/CONFIRMADO futuro e concluir apenas CONFIRMADO cujo término passou. CONCLUIDO/CANCELADO são terminais.
- RF-408: Qualquer alteração administrativa de status é auditada na mesma transação.
- RF-409: O frontend fornece filtros, visualização por dias, lista paginada, estados e interface de reserva manual, com mensagens de erro e sucesso.

## Critérios de aceitação
- Dado visitante, cliente comum ou profissional, quando consulta as rotas administrativas, então recebe 401/403 sem dados pessoais.
- Dada pesquisa por cliente com termo pequeno, quando enviada, então recebe HTTP 400.
- Dado período maior que 31 dias ou data inválida, quando consulta calendário, então recebe HTTP 400.
- Dado conta ADMIN, quando busca por profissional e status, então somente agendamentos correspondentes são retornados.
- Dado administrador tentando reservar um horário ocupado, quando envia o pedido, então HTTP 409 e nenhum novo registro ativo é criado.
- Dado cliente inexistente ou não CLIENTE, quando ADMIN tenta reservar em seu nome, então HTTP 404.
- Dado reserva CONFIRMADO futura, quando ADMIN tenta concluir, então HTTP 409.
- Dado reserva ativa futura, quando ADMIN cancela, então seu status muda para CANCELADO, um evento é auditado e o horário volta a ser oferecido.
- Dado reserva PENDENTE futura, quando ADMIN confirma, então fica CONFIRMADO.
- Dada reserva CONFIRMADO com horário já encerrado, quando ADMIN conclui, então fica CONCLUIDO.

## Fora do escopo
Novo cadastro feito por ADMIN, editar horário de reserva existente, pagamentos, notificações, multitenancy, relatórios financeiros, exportação e testes E2E em navegador. Estes últimos pertencem à Fase 5.
