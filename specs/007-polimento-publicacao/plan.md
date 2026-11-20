# Plano: E2E e preparação de deploy

## Testes no navegador
Adicionar `@playwright/test` e `@axe-core/playwright` como dependências de desenvolvimento da raiz. O arquivo `playwright.config.ts` executa Chromium desktop e mobile, em uma instância por vez e com trace/screenshot em falhas.

O workflow `.github/workflows/e2e.yml` prepara PostgreSQL 16 descartável, migrações, seed e duas contas artificiais por comandos de bootstrap já existentes. Inicia API e Vite localmente, confirma readiness e executa fluxos reais no navegador. O relatório é armazenado como artefato por até 7 dias somente se houver falhas.

O CI tradicional `.github/workflows/ci.yml` permanece responsável por build, testes unitários, autorização, concorrência e integridade do banco.

## Segurança
Um hook onSend aplica proteção de cache e headers defensivos. Em modo production, `WEB_ORIGIN` HTTPS é obrigatório para evitar execução aparentemente produtiva com cookies inseguros e origem HTTP. Alterações são verificadas com testes API sem banco.

Não declarar a aplicação pronta para produção: faltam limitação distribuída de tentativas, recuperação de senha, gestão de segredos, retenção de dados e auditoria mais ampla.

## Acessibilidade
Oferecer skip link para o main, foco visual, suporte a movimento reduzido e teste de teclado. O axe analisa o formulário de autenticação; isso não equivale a uma certificação de acessibilidade de todas as telas.

## Publicação
Documentação orienta proxy reverso HTTPS com frontend e API na mesma origem, PostgreSQL privado e backups versionados. Deploy externo demanda contas do usuário, domínio e segredos e não faz parte das ações automáticas sem aprovação e credenciais.

## Riscos
- Playwright exige download do Chromium e bibliotecas de sistema; workflow usa ubuntu-24.04 e `npx playwright install --with-deps chromium`.
- Testes em dispositivos móveis são emulados pelo navegador, não testes em aparelhos físicos.
- Testes E2E usam contas fictícias e banco descartável; não devem executar contra produção.
- Cabeçalhos de segurança não substituem proxy HTTPS e políticas de infraestrutura.
