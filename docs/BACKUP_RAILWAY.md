# Backups independentes do AgendaFlow (PostgreSQL real da Railway)

## Objetivo e limites

O PostgreSQL hospedado no serviço `Postgres` da Railway possui volume persistente, mas **volume não equivale a backup**. A plataforma oferece backups nativos pelo painel do volume, na aba **Backups**. Essa opção deve ser habilitada de preferência.

Além disso, existe a alternativa independente versionada em `ops/backup/`:

1. Conectar ao PostgreSQL por `DATABASE_URL` privada (`pg_dump` faz leitura lógica). Após verificar o S3, o job escreve somente uma linha de controle da última cópia íntegra em `backup_verifications`.
2. Salvar um arquivo custom do `pg_dump` em diretório temporário.
3. Abrir uma instância local descartável do PostgreSQL dentro do job e executar `pg_restore` completo.
4. Verificar a tabela de migrações e a restrição contra reservas sobrepostas.
5. Enviar **somente após passar a restauração** para um bucket privado S3 da Railway, conferir o tamanho remoto, baixar o objeto e validar que todos os bytes correspondem ao dump restaurado.
6. Atualizar no banco a hora e o SHA256 do dump verificado, **sem incluir chaves de objetos nem segredos**. O endpoint `/api/v1/backups/ready` fornece somente o estado público `fresh` ou `unavailable`.
7. Apagar todos os arquivos e processos locais, inclusive em caso de falha.

Não use dados reais de clientes na demonstração. O job exige `DEMO_MODE=true`, não contém senhas no código e não cria URL pública para os arquivos.

## Estado implementado (20/11/2026)

A infraestrutura real foi provisionada no projeto `agendaflow-demo`, ambiente `production`, região `iad`: serviço sem domínio `agendaflow-db-backup` e bucket privado `agendaflow-backups`. As sete variáveis são referências de ambiente, sem senha no GitHub. O serviço usa a imagem gerada por `ops/backup/Dockerfile`, com reinício desabilitado e Cron Schedule **`20 3 * * *`** (00:20 em São Paulo).

**Validação real:** em 20/11/2026 o job leu o banco PostgreSQL hospedado sem interrompê-lo, criou dump custom, restaurou em servidor temporário, verificou migrações/restrição de conflitos, enviou o arquivo ao bucket e baixou de volta para comparação byte a byte. A integridade foi aprovada duas vezes, sendo a última já com teste de download S3.

**Atualização:** o novo job de backup foi executado contra o PostgreSQL hospedado, restaurou e recuperou o arquivo do bucket, e registrou a última cópia íntegra no banco. O monitor externo do GitHub Actions confirmou `/api/v1/backups/ready` como `fresh`. O agendamento permanece `20 3 * * *` e **a primeira execução pela agenda diária ainda precisa ser observada**. Backups nativos do volume e retenção dos objetos continuam pendentes.

## Configuração na Railway

Configuração aplicada: bucket **privado** `agendaflow-backups` no mesmo ambiente do banco e serviço sem domínio público `agendaflow-db-backup`, com `Dockerfile` apontando para `ops/backup/Dockerfile` e origem na `main`. Variáveis por referência:

| Variável do job | Referência |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BACKUP_BUCKET` | `${{agendaflow-backups.BUCKET}}` |
| `BACKUP_S3_ENDPOINT` | `${{agendaflow-backups.ENDPOINT}}` |
| `AWS_ACCESS_KEY_ID` | `${{agendaflow-backups.ACCESS_KEY_ID}}` |
| `AWS_SECRET_ACCESS_KEY` | `${{agendaflow-backups.SECRET_ACCESS_KEY}}` |
| `AWS_DEFAULT_REGION` | `${{agendaflow-backups.REGION}}` |
| `DEMO_MODE` | `true` |

O Cron Schedule já está configurado como `20 3 * * *` (03:20 UTC, 00:20 em São Paulo). A Railway executa a tarefa e espera que o contêiner encerre após concluir. Não configure healthcheck HTTP para jobs.

## Recuperação

**Nunca restaure em cima do PostgreSQL ativo.** Para um procedimento de emergência, provisionar **um banco isolado**, usar `aws s3 cp` para obter o arquivo escolhido e executar `pg_restore --no-owner --no-acl --exit-on-error` nesse banco. Primeiro testar migrações, usuários, reservas e restrição de conflitos; só então planejar uma troca controlada de conexão. O teste local em cada job valida que o arquivo era recuperável no instante da criação, mas não substitui o ensaio operacional de recuperação de um arquivo já armazenado no bucket.

**Pendências operacionais:** confirmar a primeira execução automática na janela agendada, definir e implantar política de retenção do bucket, realizar um ensaio de recuperação manual a partir do bucket em serviço independente e preferencialmente habilitar também o backup nativo de volume. Um alerta básico de cópia atrasada já está ativo via GitHub Actions/Issues, com frequência de seis horas. O download e comparação do objeto armazenado já foram verificados no job. O bucket e o job podem gerar cobrança por armazenamento e execução.

## Política de retenção do bucket

A política proposta para este ambiente fictício é manter pelo menos **30 dias** de dumps íntegros e verificar uma restauração operacional antes de apagar qualquer arquivo. **Nenhum objeto é apagado automaticamente por este projeto.** Railway Buckets ainda não oferecem configuração nativa de ciclo de vida S3; portanto, não configure `put-bucket-lifecycle-configuration` presumindo que será executado. Quando o expurgo de backups for implementado, deverá preservar múltiplas cópias íntegros, usar prévia por padrão e exigir aprovação antes de exclusões definitivas.

As cópias também devem ser protegidas contra acesso não autorizado. O armazenamento S3 da Railway não oferece atualmente Object Lock ou versionamento, portanto o procedimento de cópias independentes não substitui proteção contra exclusão maliciosa.
