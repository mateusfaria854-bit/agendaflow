# 012 · Revisão final da apresentação da demonstração

## Objetivo
Alinhar os textos da interface com as funcionalidades realmente implantadas, sem apresentar a demo de portfólio como ambiente comercial pronto e sem alterar regras de agendamento.

## Requisitos
- A página inicial deve identificar a versão como demonstração online, e não como fase ainda aguardando deploy.
- O estado da API deve ser descrito como conexão real, sem referências incorretas a ambiente exclusivamente local.
- A seção de módulos não deve prometer relatórios ou indicadores que ainda não existem.
- A linha do tempo deve marcar as etapas entregues e destacar a publicação da demonstração.
- A página de contas deve informar que o cadastro é funcional, mas somente para dados fictícios.
- Preservar os fluxos de cadastro, reserva, cancelamento e administração, incluindo acessibilidade e navegação mobile.
- Manter todos os prints e o GIF reais na documentação do README.

## Critérios de aceitação
- O teste E2E valida a descrição do projeto e o indicador de conexão.
- CI de qualidade, contêiner Docker e Playwright desktop/mobile aprovados.
- Frontend e API publicados na Railway e disponíveis em HTTPS.
- Nenhum dado ou backup da demonstração apagado durante a revisão.
