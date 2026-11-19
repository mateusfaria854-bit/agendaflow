# Fase 0: Fundação técnica

## Contexto
Preparar o AgendaFlow para a implementação incremental do MVP previsto no blueprint: um negócio de serviços, três papéis e reservas seguras. Esta etapa não implementa cadastro, autenticação nem agendamentos reais.

## Requisitos
- RF-00: Um monorepo npm contém frontend React/TypeScript, API Node/TypeScript e contratos compartilhados.
- RF-01: API responde `GET /api/v1/health` sem depender do banco.
- RF-02: API responde `GET /api/v1/ready` conforme a disponibilidade do PostgreSQL.
- RF-03: Migrações versionadas criam as tabelas previstas e impõem proteção a reservas ativas sobrepostas.
- RF-04: Seed idempotente utiliza somente profissionais e serviços fictícios.
- RF-05: Verificações automatizadas incluem tipos/build, testes unitários, testes de API e teste de concorrência no banco.
- RF-06: Documentos SDD, arquitetura, comandos locais e roadmap são versionados.
- RF-07: Frontend oferece prévia visual identificada como conceitual, sem apresentar funções futuras como concluídas.

## Critérios de aceitação
- Dado o backend sem banco, quando `/api/v1/health` é consultado, então HTTP 200 é retornado.
- Dado PostgreSQL indisponível, quando `/api/v1/ready` é consultado, então HTTP 503 é retornado.
- Dado duas reservas ativas sobrepostas de um profissional, quando a segunda é gravada, então o banco rejeita a operação com código PostgreSQL `23P01`.
- Dado o seed executado duas vezes, quando os dados são consultados, então não são duplicados.
- Dado um PR, quando o CI executa, então build, testes e verificações SDD/arquitetura passam.

## Fora do escopo
Login, autorização real, catálogo administrável, algoritmo de slots, reservas reais, relatórios, notificações e deploy público do backend.
