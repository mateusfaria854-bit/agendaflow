# Fase 2: Disponibilidade e bloqueios

## Contexto
O AgendaFlow deve informar apenas horários realmente disponíveis para um serviço e profissional, respeitando jornada semanal, pausas, folgas, reservas existentes, duração do atendimento e fuso horário do negócio. Nenhuma reserva é criada nesta fase.

## Requisitos
- RF-201: Admin consulta e substitui transacionalmente períodos de expediente de cada profissional, com dia da semana (0 domingo a 6 sábado), início e fim HH:MM.
- RF-202: Períodos semanais de um mesmo profissional não podem se sobrepor; intervalos adjacentes são válidos. A lista vazia significa profissional sem agenda.
- RF-203: Admin cria e remove bloqueios excepcionais (folgas/pausas) em ISO 8601 com offset; somente datas futuras até 90 dias, duração máxima 30 dias, sem duplicação sobreposta.
- RF-204: Bloqueios não podem sobrepor reservas futuras ativas. Mudança de jornada é negada enquanto houver reservas futuras ativas, até definição de política de reagendamento na Fase 3.
- RF-205: Visitantes consultam /availability/slots escolhendo um profissional ativo, um serviço ativo que ele execute e uma data válida entre hoje e 90 dias.
- RF-206: Horários são gerados de 15 em 15 minutos, a partir da jornada no fuso BUSINESS_TIMEZONE, com término calculado pela duração do serviço.
- RF-207: Slots sobrepostos a bloqueios ou agendamentos PENDENTE/CONFIRMADO são excluídos. Conflitos no limite exato dos intervalos são permitidos.
- RF-208: Candidatos no passado, fora da jornada, durante pausas, em horários inexistentes de mudança de fuso ou que cruzam alteração de offset não podem ser oferecidos.
- RF-209: API retorna timestamps ISO UTC e rótulos HH:MM com offset; a interface mostra os horários sem habilitar reservas ainda.

## Critérios de aceitação
- Dado expediente 09:00–12:00 e 13:00–18:00, serviço de 30 minutos e segunda-feira futura, quando consultar slots, então 09:00 e 17:30 estarão disponíveis, mas 11:45 e 12:00 não.
- Dado bloqueio 10:00–11:00, quando consultar slots, então horários sobrepostos ao bloqueio não aparecem.
- Dada reserva CONFIRMADO 10:00–10:30, quando consultar disponibilidade, então 10:00 não está disponível; alterar a jornada enquanto existir reserva futura retorna 409.
- Dado usuário CLIENTE, quando tenta editar jornada, então recebe 403; visitantes recebem 401.
- Dada alteração de jornada com períodos sobrepostos, quando o admin salva, então API retorna 400 e os períodos persistidos não mudam.
- Dada data inválida ou além do horizonte de 90 dias, quando se consulta slots, então API retorna 400.
- Dada mudança para horário de verão com hora local inexistente, quando os slots são gerados, então essa hora não é fabricada.

## Fora do escopo
Criação de reservas, pagamentos, notificações, múltiplos negócios, políticas de reagendamento e agendas com turnos que cruzem a meia-noite.
