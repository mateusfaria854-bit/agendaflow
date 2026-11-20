# Fase 5: Segurança, acessibilidade, testes E2E e preparação para demonstração

## Objetivo
Validar a jornada real no navegador, reduzir riscos de segurança, preparar implantação reproduzível e documentar os limites do MVP. Publicar uma aplicação real exige infraestrutura e credenciais que não serão incluídas no repositório.

## Requisitos
- RF-501: CI abre Chromium desktop e mobile e executa cadastro, reserva, cancelamento, acesso ADMIN e acesso PROFISSIONAL, sem credenciais ou dados de usuários reais.
- RF-502: Testes de acessibilidade verificam navegação por teclado e regras WCAG A/AA principais via axe no painel de autenticação.
- RF-503: Oferecer atalho acessível para pular direto ao conteúdo principal e respeitar preferência por movimento reduzido.
- RF-504: Respostas da API enviam Cache-Control no-store, X-Content-Type-Options nosniff, X-Frame-Options DENY e Referrer-Policy no-referrer.
- RF-505: API recusa iniciar com NODE_ENV=production se WEB_ORIGIN não for URL HTTPS.
- RF-506: Documentar hospedagem de frontend e backend atrás da mesma origem HTTPS, configurações de segredos e requisitos de PostgreSQL.
- RF-507: Documentar backup, restauração e rollback de aplicação/migrações, evitando prometer reversão automática de esquemas não reversíveis.
- RF-508: GitHub Actions armazena capturas, traces e relatórios somente em falha, por 7 dias.
- RF-509: README apresenta funcionalidades demonstráveis, como testar localmente, limitações, critérios de prontidão e link para o pipeline.
- RF-510: Não divulgar credenciais de produção, URL de banco, dados pessoais reais ou links de deploy inexistentes.

## Critérios de aceitação
- `npm run check` passa e não há regressões da API.
- Workflow `e2e.yml` instala Chromium e executa Playwright sobre servidores locais e PostgreSQL descartável.
- Cadastro, agendamento e cancelamento geram resultado visível no navegador, inclusive viewport de celular.
- ADMIN acessa o calendário, PROFISSIONAL acessa sua agenda e não obtém acesso administrativo.
- A navegação por teclado alcança controles de autenticação e o relatório axe não encontra violações WCAG A/AA no painel avaliado.
- Headers de segurança e verificação de Origin são testados.
- README e GUIA_LOCAL informam claramente o que está e o que não está implantado.
- Documento de publicação explica backup, restauração e reversão do código, sem simular deploy.

## Fora do escopo deste PR
Deploy externo real com banco e domínio, monitoramento conectado a provedor, envio de e-mails, pagamento, gestão LGPD de produção, recuperação de senha e pentest externo. Esses itens dependem de infraestrutura externa e/ou credenciais.
