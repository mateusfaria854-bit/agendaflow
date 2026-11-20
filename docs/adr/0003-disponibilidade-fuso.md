# ADR 0003: Cálculo de slots por instantes UTC e fuso explícito

- **Status:** Aceita
- **Data:** 2026-11-20

## Contexto
O negócio opera por jornada semanal em horário local. Um dia pode ter 23, 24 ou 25 horas e intervalos podem cruzar a mudança de offset. Gerar horários em strings locais como se todos os dias tivessem 24 horas inventaria instantes e poderia aceitar agendamentos incorretos.

## Decisão
Usar um fuso IANA explícito por ambiente (`BUSINESS_TIMEZONE`, padrão `America/Sao_Paulo`) e percorrer instantes UTC em passos de 15 minutos. Para cada candidato, converter início e fim para relógio local via `Intl.DateTimeFormat`; validar jornada, duração, dia civil e ausência de colisões. Intervalos que atravessam mudança de offset são rejeitados nesta versão. Responder com instantes UTC e offset para diferenciar repetições no retorno do DST.

A jornada é composta por segmentos semanais disjuntos, sem atravessar a meia-noite. Pausas recorrentes são intervalos fora da jornada; folgas e exceções são armazenadas em `blocked_periods`. Reservas PENDENTE ou CONFIRMADO ocupam slots. O algoritmo não cria reservas nem bloqueia horários por si só.

## Alternativas
- Criar slots pelo relógio local e `new Date(local)`: usa fuso do servidor e ignora DST.
- Dependência de biblioteca de timezone: possível em outra etapa, mas o Intl nativo atende o escopo sem novo pacote.
- Permitir bloqueio em horário de agendamento confirmado: rejeitado até política de reagendamento.

## Consequências
Os horários em mudanças de fuso podem ter menos opções devido à rejeição de intervalos que cruzam a transição. A criação real de reservas deverá revalidar slots sob transação e impor integridade no PostgreSQL. Troca de expediente com reservas futuras é temporariamente recusada. O fuso do navegador no formulário de bloqueios pode diferir do fuso da empresa e é informado na interface.
