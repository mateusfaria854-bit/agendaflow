# Preparação da demonstração hospedada: um domínio, React e API

## Contexto
A Fase 5 já criou testes de navegador e documentação de publicação, mas a aplicação ainda não possui artefato único pronto para provedores de contêiner. Além disso, o último workflow E2E na main falhou por um seletor ambíguo, embora a reserva e o cancelamento tenham sido concluídos.

## Requisitos
- RF-801: Corrigir o seletor E2E de cancelamento para identificar o status real do cartão, sem confundir mensagens de confirmação.
- RF-802: Compilar React/Vite e API TypeScript em imagem Docker multi-stage com Node.js 22, sem incluir segredos, testes ou dependências de desenvolvimento no runtime.
- RF-803: Quando SERVE_WEB=true, o mesmo Fastify deve servir HTML e assets estáticos, conservando os endpoints /api/v1 e os cookies sob a mesma origem.
- RF-804: Caminhos da SPA sem extensão devem cair no index.html; caminhos /api/* e assets inexistentes retornam 404 correto, sem mascarar erros como HTML.
- RF-805: Ambiente publicado deve exigir WEB_ORIGIN HTTPS, com DATABASE_URL configurada no provedor e escuta no PORT fornecido.
- RF-806: Migrações e seed para contêiner devem poder ser executados com scripts Node já compilados, sem tsx/devDependencies.
- RF-807: Workflow GitHub Actions deve construir a imagem e verificar resposta HTML, healthcheck, 404 da API e bloqueio de origem externa.
- RF-808: O README e guia de hospedagem documentam os passos para configurar um serviço e PostgreSQL privado, credenciais gerenciadas, backup/rollback e ausência de URL pública até verificação real.
- RF-809: Demo externa deve utilizar somente dados fictícios e ter plano de reset/abuso; não alegar prontidão para usuários reais.

## Critérios de aceitação
- Um teste E2E em desktop e mobile verifica que uma reserva cancelada tem status Cancelado no cartão, sem seletor ambíguo.
- O build Docker sobe uma única instância da aplicação com HTML React em / e API JSON em /api/v1/health.
- A rota GET /api/v1/inexistente retorna 404 JSON e arquivo .png inexistente retorna 404, não index.html.
- O container respeita PORT e não embute DATABASE_URL nem WEB_ORIGIN de produção.
- Um comando de pré-deploy compila migrações/seed sem dependências de desenvolvimento.
- Os workflows de segurança, API, E2E e container estão verdes antes do merge.
- A documentação deixa pendente o deploy externo e não inventa URL.
