# Plano técnico: Catálogo

## Arquitetura
Rotas Fastify de leitura públicas e rotas de escrita protegidas por requireAdmin(). PostgreSQL é responsável por relacionamentos N:N e consistência via foreign keys. Interface React consulta catálogo real e permite criação/edição pelo administrador.

## Dados
Tabelas services, professionals e professional_services existentes desde a Fase 0. Sem novas colunas nesta etapa. Preço é representado em centavos inteiros e formatado em BRL apenas no frontend.

## Riscos
- Erros de validação ou vínculos órfãos: checar UUIDs e serviços ativos antes de gravar.
- Desativação de serviço não apaga vínculos existentes; apenas o oculta da consulta pública.
- Atualização de profissional e relacionamentos dentro de uma única transação.
- Nunca retornar password_hash, session token ou e-mail privado nas rotas públicas.

## Testes
CRUD administrativo com PostgreSQL, listas públicas, autorização 401/403, payloads inválidos, desativação e relacionamentos N:N.
