# Fase 3: Agendamentos reais

## Contexto
Transformar horários calculados na Fase 2 em reservas reais do cliente, mantendo integridade de agenda e privacidade. Esta entrega atende um único negócio e não possui pagamentos nem confirmações externas.

## Requisitos
- RF-301: Somente usuário autenticado com papel CLIENTE cria ou consulta suas próprias reservas. Visitantes recebem 401; profissionais/admin recebem 403 nas rotas pessoais.
- RF-302: Criar reserva recebe exclusivamente profissional, serviço e início UTC ISO. Duração, término, preço e identidade do cliente são definidos exclusivamente no backend e PostgreSQL.
- RF-303: O servidor revalida um slot sob transação, após bloquear a linha do profissional. Verifica vínculo com serviço ativo, jornada, bloqueios, reservas ativas, horário futuro e horizonte de 90 dias.
- RF-304: Reservas criadas passam a CONFIRMADO imediatamente; não são permitidas duas reservas ativas sobrepostas no mesmo profissional. Restrições do PostgreSQL permanecem como defesa secundária.
- RF-305: Cliente vê até 50 reservas mais recentes, com serviço, profissional, datas, valor congelado e status, sem dados privados de terceiros.
- RF-306: Cliente cancela a própria reserva ainda futura e em status PENDENTE/CONFIRMADO; o status passa a CANCELADO sem excluir o histórico, liberando o horário. Duplo cancelamento retorna 409.
- RF-307: Outro cliente não consegue ler ou cancelar reservas alheias. Uma tentativa de cancelamento de reserva de terceiro retorna 404, sem revelar sua existência.
- RF-308: Criação e cancelamento são registrados em audit_events, dentro da mesma transação.
- RF-309: Interface exige seleção explícita do slot e confirmação. Exibe reservas pessoais e opção de cancelar com confirmação do usuário. Ao concluir, atualiza a disponibilidade e a lista.

## Critérios de aceitação
- Dado dois clientes simultâneos tentando o mesmo slot, quando a API recebe ambas as solicitações, então uma resulta 201, outra 409 e só uma reserva é persistida.
- Dado slot ocupado ou bloqueado, quando cliente tenta reservar, então API retorna 409, sem inserir dados.
- Dado valor ou término falsificado no payload, quando cliente envia campos extras, então API retorna 400.
- Dado serviço não vinculado ao profissional, quando cliente tenta reservar, então API retorna 404.
- Dado usuário não autenticado, quando tenta consultar/criar/cancelar, então recebe 401.
- Dado cliente B tentando cancelar a reserva de A, quando solicita a ação, então recebe 404.
- Dado cancelamento válido, quando a agenda é consultada novamente, então o mesmo slot aparece livre.
- Dada reserva já cancelada ou passada, quando tenta cancelar, então recebe 409.

## Fora do escopo
Pagamento, aprovação manual, notificações, reagendamento, cancelamento pelo administrador, acompanhamento pelos profissionais e integração com WhatsApp. Administração completa do calendário pertence à Fase 4.
