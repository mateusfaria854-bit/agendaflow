# Plano técnico: reservas

## Endpoints
| Método | Caminho | Acesso | Resposta |
|---|---|---|---|
| POST | /api/v1/appointments | CLIENTE | 201 com reserva CONFIRMADO ou 409 |
| GET | /api/v1/appointments/mine | CLIENTE | Lista privada, até 50 resultados |
| PATCH | /api/v1/appointments/:id/cancel | CLIENTE titular | Status CANCELADO ou 404/409 |

A entrada de POST aceita apenas `professionalId`, `serviceId` e `startsAt` UTC ISO 8601. Nunca recebe preço, duração, fim, clientId ou status. `GET mine` inclui o fuso IANA para apresentação.

## Concorrência e integridade
O backend abre transação e usa `SELECT ... FOR UPDATE` na linha do profissional. Essa é a mesma trava usada pela Fase 2 para alterações de jornada e bloqueios. Em seguida, verifica serviço habilitado, disponibilidade, folgas e reservas ativas na própria conexão, chamando a função pura de cálculo de slots. O início solicitado deve coincidir **exatamente** com um slot gerado após a aquisição da trava.

O banco mantém a restrição `appointments_no_overlap` (EXCLUDE gist) para reservas em status PENDENTE ou CONFIRMADO. Erro `23P01` vira HTTP 409, mesmo em caso de uso por outra rota futura.

Os valores são capturados do serviço no momento da reserva e salvos em `price_cents`. O status inicial é CONFIRMADO. A resposta inclui apenas atributos públicos.

## Cancelamento
O servidor executa `UPDATE appointments SET status='CANCELADO' WHERE id=$1 AND client_id=$2 AND starts_at>now() AND status IN (...)` sob transação. A cláusula client_id impede acesso cruzado. Não há exclusão do registro; o slot fica livre porque consultas consideram somente PENDENTE/CONFIRMADO.

Criação e cancelamento registram audit_events no mesmo commit. Dados sintéticos são usados nos testes e removidos após execução.

## Interface
O componente AvailabilityPanel oferece seleção de slots para CLIENTE e confirmação explícita. BookingsPanel lista reservas e permite cancelar com confirmação. O Portal coordena atualizações para que os dois componentes reflitam a agenda em tempo real por reconsulta.

## Testes
CI roda os testes anteriores e uma suíte integrada com PostgreSQL: dois pedidos concorrentes ao mesmo slot, autorização 401/403, privacidade 404, preço definido pelo backend, status e liberação do slot após cancelar. Não é necessária uma nova migração: tabelas appointments e audit_events foram criadas na Fase 0.

## Limitações e riscos
- A disponibilidade exibida pode mudar antes do POST; 409 informa conflito sem gravar reserva.
- O cálculo de horário mantém a política da Fase 2 sobre fuso e transições de horário de verão.
- A consulta pessoal retorna apenas as 50 reservas mais recentes; paginação e filtros ficam para outra etapa.
- Não incluir dados reais de clientes no repositório e configurar TLS/cookies seguros em eventual deploy público.
