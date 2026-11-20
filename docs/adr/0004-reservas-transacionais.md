# ADR 0004: Reservas sob lock de profissional + exclusão PostgreSQL

- **Status:** Aceita
- **Data:** 2026-11-20

## Contexto
Uma listagem de horários livres não basta para garantir exclusividade. Clientes simultâneos podem tentar confirmar o mesmo horário, e um administrador pode cadastrar um bloqueio durante uma tentativa de reserva. O frontend não consegue resolver esse conflito com confiabilidade.

## Decisão
A operação de reserva adquire um lock pessimista `FOR UPDATE` no registro do profissional e, **na mesma transação**, revalida duração, vínculo com o serviço, expediente, bloqueios e reservas atuais. Somente inícios correspondentes a slots calculados pelo servidor são aceitos. A operação grava `CONFIRMADO`, preço capturado no momento da criação e evento de auditoria antes de confirmar a transação.

A restrição `EXCLUDE USING gist` no PostgreSQL já proíbe intervalos sobrepostos de reservas PENDENTE/CONFIRMADO para o mesmo profissional, funcionando como defesa adicional. O erro SQL 23P01 é tratado como conflito 409.

Cancelamento usa atualização condicional de status e client_id, sem exclusão do histórico. Eventos de auditoria são gravados transacionalmente.

## Alternativas
- Apenas consultar slots e fazer INSERT: rejeitada devido a condição de corrida com bloqueios/expedientes.
- Somente mutex em memória: rejeitada porque não funciona com múltiplas instâncias da API.
- Somente constraint de exclusão: evitaria dupla reserva, mas não verificaria expediente, bloqueios ou vínculo de serviço no momento da confirmação.
- Excluir reserva cancelada: perderia histórico e rastreabilidade.

## Consequências
Pedidos concorrentes ao mesmo profissional são serializados, mas reservas de profissionais diferentes podem ocorrer em paralelo. O servidor assume responsabilidade por preço, identidade, status e duração, ignorando qualquer tentativa do cliente de definir esses valores. Não há criação de pagamentos ou confirmação externa nesta fase. A gestão administrativa completa será especificada separadamente.
