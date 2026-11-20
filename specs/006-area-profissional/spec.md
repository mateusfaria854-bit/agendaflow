# Complemento da Fase 4: Área profissional

## Contexto
A Fase 4 entregou o calendário administrativo. Falta dar ao papel PROFISSIONAL uma agenda própria, sem expor dados financeiros, e-mail de clientes ou agendamentos de colegas.

## Requisitos
- RF-451: A conta de profissional é provisionada por comando local explícito, com profissional cadastrado, nome, e-mail exclusivo e senha forte. O cadastro público continua restrito a CLIENTE.
- RF-452: O provisionamento é transacional e usa a coluna UNIQUE professionals.user_id já existente. Não altera contas existentes, não admite segundo vínculo nem deixa conta solta se houver conflito.
- RF-453: Somente sessão com role PROFISSIONAL lê GET /api/v1/staff/me e GET /api/v1/staff/appointments; visitantes recebem 401, CLIENTE e ADMIN recebem 403.
- RF-454: A agenda é identificada exclusivamente por professionals.user_id igual ao usuário da sessão. Não aceita professionalId externo ou outros parâmetros inesperados.
- RF-455: Acesso sem vínculo ou com cadastro profissional inativo responde 404 sem expor agenda.
- RF-456: O profissional filtra sua agenda por início e fim (até 31 dias), status e deslocamento. Resultados retornam até 100 linhas por página.
- RF-457: A resposta de agenda contém horários UTC, status, nome do serviço e nome do cliente; não expõe email de cliente, preço, dados financeiros ou informações de outro profissional.
- RF-458: O frontend exibe uma área profissional responsiva e somente leitura; alterações de status continuam exclusivas de ADMIN.
- RF-459: O administrador consegue visualizar se cada profissional cadastrado possui conta vinculada, mas essa informação não aparece no catálogo público.

## Critérios de aceitação
- Dado visitante, CLIENTE ou ADMIN, quando consulta /staff/appointments, então recebe 401 ou 403.
- Dado PROFISSIONAL sem vínculo ou com registro desativado, quando acessa /staff/me, então recebe 404.
- Dadas duas contas PROFISSIONAL diferentes com agendamentos de profissionais distintos, quando consultam a própria agenda, então cada uma vê apenas seus próprios atendimentos.
- Dada tentativa de enviar professionalId=OUTRO_ID, quando consulta a agenda, então a API rejeita o parâmetro inesperado com 400.
- Dado profissional autenticado, quando a resposta é serializada, então não contém clientEmail, priceCents ou campos administrativos.
- Dada tentativa de reutilizar e-mail ou profissional já vinculado, quando a conta é provisionada, então é recusada sem promover conta ou deixar vínculo parcial.
- Dado admin consultando os profissionais cadastrados, quando solicita a listagem, então vê hasAccount, enquanto a listagem pública não revela esse campo.

## Fora do escopo
Recuperação de senha, portal de convite por e-mail, troca de profissional entre contas, escrita de status pelo profissional, pagamentos, notificações e testes E2E em navegador. Estes permanecem para etapas futuras.
