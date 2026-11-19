# Constituição de engenharia do AgendaFlow

## Princípios
1. **Especificação antes do código.** Cada comportamento tem cenário e aceite verificáveis.
2. **Integridade no servidor e no banco.** O frontend não é a fonte final para permissões, horários ou conflitos.
3. **Simplicidade incremental.** Construir o MVP de um único negócio; sem pagamentos, marketplace ou WhatsApp obrigatório.
4. **Domínio separado da infraestrutura.** Contratos puros não importam React, Fastify ou PostgreSQL.
5. **Segurança e privacidade.** Dados sintéticos, senhas nunca em texto puro, autorização validada no backend.
6. **Testabilidade.** Funções puras, testes de API, integração no PostgreSQL e E2E para fluxos críticos.
7. **Rastreabilidade.** Specs, tarefas, testes e decisões em ADRs versionados.

## Stack de referência
React + TypeScript no frontend, Node.js + TypeScript no backend, PostgreSQL 16. Npm workspaces como monorepo; sem adicionar ferramentas extras sem necessidade comprovada.

## Definition of Done
Requisitos e critérios atualizados; testes relevantes aprovados; migrações versionadas; código respeita as fronteiras; PR revisado; documentação consistente. Nenhuma funcionalidade é dita pronta só por ter uma tela.
