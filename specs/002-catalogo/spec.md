# Fase 1: Catálogo de serviços e profissionais

## Contexto
O administrador mantém os serviços prestados e os profissionais aptos a realizá-los. Visitantes consultam o catálogo ativo sem acesso aos detalhes administrativos.

## Requisitos
- RF-121: Visitantes consultam serviços e profissionais ativos, incluindo os vínculos entre eles.
- RF-122: Admin cria e edita serviços com nome, duração de 5 a 480 minutos e preço não negativo em centavos inteiros.
- RF-123: Admin ativa ou desativa serviços sem apagar registros históricos.
- RF-124: Admin cria e edita profissionais e vincula/desvincula serviços habilitados.
- RF-125: Endpoints de mutação exigem sessão ADMIN; visitantes e clientes não podem alterar catálogo.
- RF-126: Operações sobre vínculos são transacionais; IDs inválidos ou serviços inativos são rejeitados.

## Critérios de aceitação
- Dado visitante, quando consulta /services e /professionals, então apenas registros ativos são exibidos.
- Dado cliente autenticado, quando cria serviço, então recebe 403 e nenhum registro é alterado.
- Dado admin, quando cria serviço válido, então o item aparece no catálogo público.
- Dado duração menor que 5 ou preço negativo, quando o serviço é enviado, então recebe 400.
- Dado profissional com serviços válidos, quando atualiza seus vínculos, então a alteração é atômica no PostgreSQL.
- Dado serviço desativado, quando consulta o catálogo, então o item deixa de ser exibido e não pode ser associado em novos vínculos.

## Fora do escopo
Cálculo de slots disponíveis, agendamentos, jornadas, reservas e pagamento.
