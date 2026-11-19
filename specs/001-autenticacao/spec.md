# Fase 1: Autenticação e perfis

## Contexto
O AgendaFlow possui três perfis: cliente, profissional e administrador. A identidade real e o controle de acesso serão introduzidos após a fundação técnica.

## Requisitos
- RF-01: Cliente cria conta com e-mail único e senha segura.
- RF-02: Usuário autenticado acessa somente seus recursos e papéis permitidos.
- RF-03: Sessões são protegidas; credenciais não aparecem em logs nem são armazenadas em texto puro.
- RF-04: Ações administrativas verificam autorização no backend.

## Critérios de aceitação
- Dado e-mail já cadastrado, quando o cliente tenta registrar, então recebe erro de conflito sem vazamento de dados.
- Dado usuário não autenticado, quando acessa rota restrita, então recebe HTTP 401.
- Dado cliente comum, quando tenta alterar serviços, então recebe HTTP 403.
- Dado senha incorreta, quando tenta login, então a autenticação não é concedida.

## Fora do escopo
OAuth, login social, marketplace, assinatura e pagamentos.
