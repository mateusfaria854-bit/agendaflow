# ADR 0002: Sessões opacas e autorização no servidor

- **Status:** Aceita
- **Data:** 2026-11-19
- **Contexto:** autenticação para clientes e administradores em uma aplicação web com frontend React e API Fastify, sem serviço de identidade externo.

## Decisão
- Hash de senha com Node.js `scrypt`, salt aleatório e parâmetros versionados.
- Token de sessão com 32 bytes aleatórios em cookie HttpOnly, SameSite=Lax e Secure em produção, expirando em sete dias.
- PostgreSQL guarda apenas SHA-256 do token de sessão, nunca o valor que o navegador recebe.
- A sessão é consultada no banco em cada requisição protegida, permitindo revogação no logout e atualização imediata de papéis.
- O cadastro público atribui CLIENTE; o primeiro ADMIN é criado somente pelo comando local com variáveis temporárias e não há credenciais padrão.
- Cabeçalho Origin é validado para requisições mutáveis e login tem limite de tentativas por IP na instância.

## Alternativas consideradas
- Guardar token no localStorage: amplia a exposição a scripts injetados, rejeitado.
- Token JWT stateless: revogação imediata e papéis atualizados exigiriam controles adicionais.
- Cadastro público de administrador: rejeitado por permitir elevação de privilégio.

## Consequências e limitações
Cookies exigem mesma origem do frontend e API (ou proxy) e HTTPS em produção. O rate limiting local não atende múltiplas instâncias e deve ser substituído por solução distribuída. Ainda faltam fluxo de recuperação de senha e verificação de e-mail, que não integram o MVP inicial desta fase. O deploy produtivo requer revisão adicional, auditoria e proteção da infraestrutura.
