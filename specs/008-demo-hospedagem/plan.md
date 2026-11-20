# Plano: preparação de contêiner para demo

## Frontend e API na mesma origem
Adicionar @fastify/static compatível com Fastify 5. A API registra arquivos de apps/web/dist somente com SERVE_WEB=true. Caminhos dinâmicos da SPA servem index.html como fallback, mas /api e assets ausentes recebem 404, não HTML com sucesso. Os testes tradicionais continuam criando Fastify sem SERVE_WEB.

O diretório público é resolvido relativamente a import.meta.url, de forma que funcione tanto em apps/api/src/app.ts quanto no compilado apps/api/dist/app.js. Em produção, NODE_ENV=production exige WEB_ORIGIN em HTTPS e usa cookies Secure.

## Docker
A etapa build instala npm workspaces, compila os três pacotes e remove dependências dev. A etapa runtime usa Node 22, usuário não-root e copia apenas os pacotes compilados, static build, migrações SQL, node_modules de produção e manifests. O comando padrão inicia dist/server.js.

Migrações e seed têm scripts runtime compilados no pacote API. Um provedor deve executar as migrações (e, exclusivamente no ambiente de demonstração, o seed) antes de liberar tráfego; não incluir credenciais no Dockerfile.

## CI
Adicionar container-demo.yml executando docker build e smoke test de HTTP. O teste E2E volta a usar seletor específico para status de cancelamento. Os checks de banco e navegador continuam independentes e devem passar.

## Publicação
Preferir provedor com GitHub, banco PostgreSQL gerenciado e domínio HTTPS. Conectar apenas a branch main após merge. Configurar secrets via interface do provedor, volume/backups e processo de reset dos dados fictícios. A criação do projeto, domínio e banco externo precisa de autorização/acesso e verificação independente.
