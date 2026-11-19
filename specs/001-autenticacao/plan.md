# Plano técnico: Autenticação e perfis

## Arquitetura
- Módulo de identidade em apps/api/src/modules/auth: hashing, sessões e rotas HTTP.
- Senhas com scrypt, salt aleatório e parâmetros versionados; comparação resistente a ataques de timing.
- Tokens de sessão gerados com 32 bytes aleatórios, persistindo somente SHA-256 no PostgreSQL.
- Cookie HttpOnly, SameSite=Lax, Path=/ e Secure em NODE_ENV=production; validade de 7 dias.
- Autorização centralizada no backend. No navegador, a interface de catálogo somente mostra ações autorizadas, mas não é mecanismo de segurança.
- Validação JSON com Fastify/Ajv. Origem de requisições de escrita conferida pelo servidor; sem CORS amplo.
- Limitação local em memória para tentativas de login por IP: mitigação de desenvolvimento, não substitui rate-limit de produção distribuído.

## Dados
Migration 0002_session.sql cria sessions com hash exclusivo, user_id e expires_at, além de índice de expiração. A tabela users da Fase 0 permanece inalterada.

## Segurança e riscos
- Cadastro sempre CLIENTE. O administrador inicial exige CLI com ADMIN_EMAIL, ADMIN_NAME e ADMIN_PASSWORD, sem valor padrão.
- Erros de login uniformes, sem retornar hash ou IDs de sessão.
- Requisições cross-origin são negadas por Origin; sessões não funcionam com frontend hospedado em outra origem sem configuração explícita de proxy e WEB_ORIGIN.
- Segurança de produção exige TLS, proteção da rota de bootstrap, auditoria, gestão de infraestrutura e rate limiting persistente.

## Testes
Testes unitários de hashing/verificação, endpoints com injeção Fastify, integração com PostgreSQL em CI para registro/login/logout, 401/403, payload malicioso, CRUD administrativo e cookies.
