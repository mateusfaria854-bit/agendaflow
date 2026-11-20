# Backups independentes do AgendaFlow (PostgreSQL real da Railway)

## Objetivo e limites

O PostgreSQL hospedado no serviço `Postgres` da Railway possui volume persistente, mas **volume não equivale a backup**. A plataforma oferece backups nativos pelo painel do volume, na aba **Backups**. Essa opção deve ser habilitada de preferência.

Além disso, existe a alternativa independente versionada em `ops/backup/`:

1. Conectar ao PostgreSQL por `DATABASE_URL` privada (somente leitura lógica via `pg_dump`).
2. Salvar um arquivo custom do `pg_dump` em diretório temporário.
3. Abrir uma instância local descartável do PostgreSQL dentro do job e executar `pg_restore` completo.
4. Verificar a tabela de migrações e a restrição contra reservas sobrepostas.
5. Enviar **somente após passar a restauração** para um bucket privado S3 da Railway, comparar o tamanho remoto e finalizar.
6. Apagar todos os arquivos e processos locais, inclusive em caso de falha.

Não use dados reais de clientes na demonstração. O job exige `DEMO_MODE=true`, não contém senhas no código e não cria URL pública para os arquivos.

## Configuração na Railway

Configure um bucket **privado** (exemplo `agendaflow-backups`) no mesmo ambiente do banco e um serviço sem domínio público (exemplo `agendaflow-db-backup`), com `Dockerfile` apontando para `ops/backup/Dockerfile` e origem na `main`. Variáveis por referência:

| Variável do job | Referência |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BACKUP_BUCKET` | `${{agendaflow-backups.BUCKET}}` |
| `BACKUP_S3_ENDPOINT` | `${{agendaflow-backups.ENDPOINT}}` |
| `AWS_ACCESS_KEY_ID` | `${{agendaflow-backups.ACCESS_KEY_ID}}` |
| `AWS_SECRET_ACCESS_KEY` | `${{agendaflow-backups.SECRET_ACCESS_KEY}}` |
| `AWS_DEFAULT_REGION` | `${{agendaflow-backups.REGION}}` |
| `DEMO_MODE` | `true` |

Após conferir o sucesso **de uma execução real**, configure o Cron Schedule para `20 3 * * *` (03:20 UTC, 00:20 em São Paulo). A Railway executa a tarefa, aguarda o término e encerra o contêiner. Não configure healthcheck HTTP para jobs.

## Recuperação

**Nunca restaure em cima do PostgreSQL ativo.** Para um procedimento de emergência, provisionar **um banco isolado**, usar `aws s3 cp` para obter o arquivo escolhido e executar `pg_restore --no-owner --no-acl --exit-on-error` nesse banco. Primeiro testar migrações, usuários, reservas e restrição de conflitos; só então planejar uma troca controlada de conexão. O teste local em cada job valida que o arquivo era recuperável no instante da criação, mas não substitui o ensaio operacional de recuperação de um arquivo já armazenado no bucket.

**Pendências antes de declarar backup definitivo:** verificar que o serviço foi executado e enviou um objeto ao bucket, definir política de retenção e alertas para falha, testar recuperação de um objeto armazenado e preferencialmente habilitar também o backup nativo de volume. O bucket e o job podem gerar cobrança por armazenamento e execução.
