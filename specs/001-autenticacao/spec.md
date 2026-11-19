# Fase 1: Autenticação e perfis

## Contexto
Clientes criam contas e acessam sua sessão; administradores administram o catálogo. O AgendaFlow possui três papéis no banco: CLIENTE, PROFISSIONAL e ADMIN. Nesta fase, o perfil PROFISSIONAL não possui uma área própria de gerenciamento.

## Requisitos
- RF-101: Um cliente cria conta com nome, e-mail único e senha de pelo menos 12 caracteres; o backend atribui o papel CLIENTE, nunca aceitando elevação via cadastro público.
- RF-102: O login valida credenciais e abre uma sessão aleatória com expiração, mantida no PostgreSQL e em cookie HttpOnly.
- RF-103: Logout invalida a sessão no banco e limpa o cookie; /auth/me consulta a sessão vigente.
- RF-104: Rotas administrativas verificam o papel ADMIN no servidor e negam clientes e visitantes.
- RF-105: Há limite de tentativas de login por IP na instância e falhas de autenticação não revelam se o usuário existe.
- RF-106: Mutações exigem origem compatível com a aplicação; cookies possuem SameSite e Secure em produção.
- RF-107: O primeiro administrador é criado com comando local explícito, sem credencial pronta no repositório.

## Critérios de aceitação
- Dado e-mail já cadastrado, quando o cliente tenta registrar novamente, então recebe 409.
- Dado payload com role ADMIN em cadastro público, quando é enviado, então o backend o rejeita.
- Dada senha incorreta, quando o usuário tenta login, então recebe 401 sem abrir sessão.
- Dado visitante, quando acessa /auth/me ou rota administrativa, então recebe 401.
- Dado cliente autenticado, quando tenta cadastrar serviço ou profissional, então recebe 403.
- Dada sessão válida, quando efetua logout, então o token deixa de autenticar e o cookie é invalidado.
- Dada requisição de mutação com Origin externo, quando chega ao servidor, então é rejeitada com 403.

## Fora do escopo
OAuth, recuperação de senha por e-mail, verificação de e-mail, múltiplos negócios, permissões granulares, agendamentos e pagamentos. Deploy produtivo requer HTTPS, monitoramento de login e limitação de tentativas distribuída.
