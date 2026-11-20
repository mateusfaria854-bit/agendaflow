# Plano técnico: Fase 4

## Camadas
- `apps/api/src/modules/admin/routes.ts` expõe quatro rotas ADMIN, com autenticação/autorização aplicada antes de consultas pessoais.
- `apps/api/src/modules/appointments/service.ts` centraliza a criação de reserva antes implementada apenas na rota de cliente.
- `apps/api/src/modules/appointments/routes.ts` chama o serviço compartilhado, preservando a API pública existente.
- `apps/web/src/features/admin/AdminCalendar.tsx` e CSS encapsulam calendário, filtros, paginação, busca de clientes e reservas manuais.
- A interface é integrada ao Portal somente se `user.role==='ADMIN'`.

## Rotas e contratos
| Método | Rota | Requer | Operação |
|---|---|---|---|
| GET | /api/v1/admin/appointments?from=&to=&professionalId=&status=&offset= | ADMIN | Listagem + totais, até 100 por página |
| GET | /api/v1/admin/clients?query= | ADMIN | Pesquisa por nome/e-mail, até 15 |
| POST | /api/v1/admin/appointments | ADMIN | Criar reserva para CLIENTE existente |
| PATCH | /api/v1/admin/appointments/:id/status | ADMIN | Confirmar, concluir ou cancelar |

POST exige `clientId`, `professionalId`, `serviceId` e `startsAt` UTC; não aceita preço/status/fim.
O calendário usa `($date::timestamp AT TIME ZONE $timezone)` no PostgreSQL para corresponder aos dias civis do negócio, incluindo eventuais mudanças de offset.

## Regras e consistência
A criação passa pelo mesmo serviço `createBooking` de ambos os perfis, com `SELECT ... FOR UPDATE` do profissional, consulta de slot atualizado e `EXCLUDE gist` no banco. A conta de destino deve ter o papel CLIENTE.

Para alterar status, o administrador localiza o profissional, adquire primeiro sua trava, depois a da reserva, revalida estado e tempo e grava status + `audit_events` em uma transação.

Matriz de transições:
- PENDENTE -> CONFIRMADO: somente antes do início.
- PENDENTE/CONFIRMADO -> CANCELADO: somente antes do início.
- CONFIRMADO -> CONCLUIDO: somente após o término.
- CANCELADO/CONCLUIDO: estados terminais.

A interface não substitui a validação da API e não altera disponibilidade diretamente.

## Segurança e limites
- Dados do cliente só são retornados em rotas ADMIN. Pesquisa exige três caracteres.
- Filtros são validados no backend: formato de data, período de até 31 dias, UUID e status enumerado.
- Páginas limitadas a 100 itens, deslocamento máximo de 10.000. Em alto volume, substituir OFFSET por paginação cursor.
- Datas de operação usam o fuso configurado para o negócio, padrão America/Sao_Paulo.
- Dados sintéticos e contas temporárias em testes; não inserir credenciais no repositório.

## Testes
Suite PostgreSQL de integração cobrindo 401/403, pesquisa de clientes, filtros, payload malicioso, reserva manual, 409 de conflito, transições permitidas/proibidas, reabertura de slot cancelado e auditoria. Testes anteriores da Fase 3 devem continuar aprovados. Testes E2E de interface ficam para Fase 5.
