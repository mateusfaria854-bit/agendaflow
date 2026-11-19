# Plano técnico: Autenticação e perfis

## Arquitetura
API terá módulo de identidade isolado com rotas, aplicação e repositório; middleware de autorização verifica os três perfis. Frontend terá formulários com estados de carregamento e erro sem expor dados sensíveis.

## Dados
Utilizar `users` já criado na Fase 0. Armazenar somente hash seguro de senhas; definir estratégia de sessão HTTP-only e expiração antes de implementar.

## Riscos
Enumerar contas via erros, brute force no login, autorização somente na UI e segredos em repositório. Escolha de estratégia de sessão será documentada em ADR.

## Testes
Unitários de validação e permissões, integração de registro/login e cenários 401/403, controles de sessão.
