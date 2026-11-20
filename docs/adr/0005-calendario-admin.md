# ADR 0005: Operação administrativa e regras de transição

- **Status:** Aceita
- **Data:** 2026-11-20

## Contexto
A Fase 4 precisa oferecer uma agenda de operação para administradores sem criar regras paralelas para reserva manual nem oferecer transições arbitrárias que prejudiquem disponibilidade, histórico ou privacidade.

## Decisão
- Criar módulo `admin` isolado, com autorização no backend em cada rota.
- Consultar períodos como dias civis no fuso IANA de negócio, usando conversão SQL para `timestamptz`.
- Listar até 100 atendimentos por página e expor total/contagens para filtros; pesquisar clientes por nome ou e-mail somente após três caracteres.
- Extrair `createBooking` para serviço compartilhado entre a API de cliente e de administrador, com lock do profissional, revalidação de horário e restrição SQL de sobreposição.
- Tratar CONFIRMADO/CANCELADO/CONCLUIDO/PENDENTE como uma máquina de estados restrita, permitindo apenas confirmação de pendente futuro, cancelamento de ativo futuro e conclusão de atendimento já encerrado.
- Auditar toda criação administrativa e transição, dentro da mesma transação de dados.

## Consequências
O administrador não pode criar reserva em horário ocupado nem para usuário que não seja CLIENTE. A lista administrativa contém identificadores e dados de contato pessoais, protegidos por sessão ADMIN. Paginação por offset é adequada para o MVP, mas pode exigir cursor em alto volume. Testes E2E e verificação de acessibilidade completa permanecem na Fase 5.
