# 013 · Verificação diária do backup agendado

## Objetivo

Detectar cedo a ausência de uma cópia PostgreSQL validada depois do horário previsto de 03:20 UTC, sem depender apenas do alerta de 36 horas.

## Requisitos

- Endpoint de observabilidade somente no ambiente de demonstração, em `/api/v1/backups/daily`.
- Status 200 apenas se o último backup validado tiver sido registrado após a última janela esperada das 03:20 UTC, com tolerância de cinco minutos para desvio de relógio.
- Resposta genérica de sucesso ou indisponibilidade, sem divulgar registros, hashes, horários exatos, nomes de objetos ou credenciais.
- GitHub Actions deve verificar diariamente às 08:30 UTC, cinco horas após o cron da Railway.
- Em falha, criar ou atualizar uma issue própria do backup diário. Em recuperação, encerrar apenas o incidente correspondente.
- A checagem não prova que foi o job agendado que gerou o backup: uma cópia manual posterior ao horário de corte também cumpre o objetivo de disponibilidade.
- Não alterar a política de cópias, apagar arquivos ou executar expurgo.

## Critérios de aceitação

- Testes unitários da janela UTC e viradas de dia/ano.
- Testes do endpoint com cópia válida, ausente e modo demo desligado.
- CI de qualidade, Docker e E2E aprovados.
- Serviço web implantado e resposta HTTP conferida antes de considerar o monitor diário ativo.
