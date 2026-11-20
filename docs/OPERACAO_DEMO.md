# Operação e incidentes da demonstração

## Visão geral

Projeto Railway `agendaflow-demo` (environment `production`), serviço web `agendaflow-web`, banco privado `Postgres` e serviço cron `agendaflow-db-backup`. O bucket privado `agendaflow-backups` recebe o dump PostgreSQL validado por restauração local e recuperação do S3.

As cópias de segurança e o banco devem permanecer privados. Não publique variáveis, logs com dados pessoais, URL do banco ou conteúdo dos dumps.

## Checagem de disponibilidade

Workflow [Disponibilidade da demo HTTPS](../.github/workflows/demo-uptime.yml) (a cada seis horas) verifica DNS, TLS, `/api/v1/health`, `/api/v1/ready`, `/api/v1/backups/ready`, HTML e favicon. O endpoint de backup retorna HTTP 503 quando não há cópia verificada nas últimas 36 horas.

Quando o workflow falha, inclusive quando o cron de backup deixa de registrar uma cópia nova, abre ou atualiza uma issue com o label `agenda-demo-uptime`. Quando passa, encerra automaticamente a issue aberta. Incidentes duplicados são evitados por label.

Isso registra falhas no GitHub, **não garante push, e-mail, SMS ou resposta imediata**. O intervalo de 6 horas pode atrasar a detecção.

## Checagem diária de backups

Além do alerta de 36h, o workflow [Auditoria diária do backup](../.github/workflows/backup-daily-audit.yml) roda às **08h30 UTC** e exige que `/api/v1/backups/daily` confirme uma cópia íntegra posterior ao último agendamento esperado das 03h20 UTC. O retorno é somente `verified` (HTTP 200) ou `unavailable` (HTTP 503); horários, hashes e chaves do bucket não são expostos.

Falhas geram ou atualizam uma issue com o rótulo `agenda-backup-diario`. A recuperação encerra apenas essa issue, sem interferir nos incidentes gerais `agenda-demo-uptime`. A verificação pode ser acionada manualmente, mas isso não executa um backup nem apaga arquivos.

A presença de uma cópia após o horário de corte **não demonstra qual processo a produziu**. É necessário inspecionar os logs de execução da Railway para atestar que o cron diário funcionou. A primeira execução agendada com a nova simulação S3 continua pendente de confirmação.

## Resposta a falhas

1. Conferir a execução do GitHub Actions e qual check falhou.
2. Conferir o Railway Dashboard, ambiente `production`, e identificar se `agendaflow-web` e `Postgres` estão online.
3. Se a API retornar 503 em `/api/v1/ready`, conferir rede privada, variáveis de referência e saúde do PostgreSQL sem imprimir `DATABASE_URL`.
4. Se frontend falhar, conferir build Docker e domínio/porta da Railway; não alterar o banco por causa de erro estático.
5. Se o backup falhar, analisar o log do cron `agendaflow-db-backup` e confirmar a existência de um novo arquivo no bucket privado. **Não execute limpeza destrutiva** até garantir backup válido.
6. Confirmar recuperação por checagem externa e registrar causa/correção na issue.

## Proteções do serviço

A API envia `Cache-Control: no-store`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`; em produção, também envia HSTS. Os cadastros da demo aceitam apenas `@example.invalid` e usam limite local conservador por IP. Não há proteção distribuída de borda.

## Retenção dos backups

O script [retention.py](../ops/backup/retention.py) calcula apenas uma prévia da retenção S3 (mínimo 30 dias e últimas 14 cópias preservadas). Mesmo quando mostra uma estimativa de arquivos antigos, **nenhum arquivo é apagado**. Consulte [guia de retenção S3](RETENCAO_BACKUPS.md). Não inserir credenciais do bucket em issues ou logs.

## Pendências

- Habilitar snapshots nativos do volume PostgreSQL na aba Backups do Railway.
- Definir retenção segura dos objetos S3 (Railway Bucket não suporta lifecycle nativo) e alertas com notificações fora do GitHub; o alerta de ausência de cópia verificada está ativo via issue.
- Verificar periodicamente a restauração operacional de um arquivo do bucket para um banco de recuperação isolado.
- Avaliar disponibilidade com intervalos menores e canal de notificação.
- Manter o expurgo automático de contas de demonstração desabilitado até essas verificações.
