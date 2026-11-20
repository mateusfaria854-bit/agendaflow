# Inventário de retenção dos backups S3

## Estado atual

**Prévia somente leitura. Nenhum backup é excluído automaticamente ou por argumento de CLI.** A implementação está em [ops/backup/retention.py](../ops/backup/retention.py), testada com inventários sintéticos. O script exige DEMO_MODE=true, BACKUP_BUCKET e BACKUP_S3_ENDPOINT e usa apenas AWS CLI \`s3api list-objects-v2\`.

Após o backup noturno restaurado e recuperado do S3, o serviço \`agendaflow-db-backup\` executa um inventário do prefixo fixo \`agendaflow/demo/daily/\`. A simulação é complementar e seu erro não invalida um dump já restaurado e confirmado.

## Política proposta

- Prazo mínimo de preservação: **30 dias**, contado do horário LastModified informado pelo S3.
- **14 cópias mais recentes** protegidas, mesmo quando já têm mais de 30 dias.
- Sem cópia nas últimas **36 horas**, menos de 14 objetos reconhecidos, paginação incompleta ou arquivos com nomes inesperados: política bloqueada, sem candidatos.
- Nenhum outro prefixo, objeto ou formato é afetado. Um inventário com mais de 10 mil objetos também é bloqueado.
- Nenhuma saída inclui chaves S3, nomes individuais ou credenciais; somente quantidades, estimativa de bytes e motivo de bloqueio.
- A flag \`--execute\` é **explicitamente recusada**. Não existe código de deleção no repositório.

## Executar apenas uma prévia

Em um ambiente com AWS CLI instalado e credenciais **privadas** do bucket, execute:

\`\`\`bash
DEMO_MODE=true python3 ops/backup/retention.py
\`\`\`

Use somente variáveis de ambiente da Railway, sem colocar senhas em argumentos ou arquivos versionados. O script não baixa nem abre arquivos de backup; consulta somente os metadados retornados pelo bucket.

A saída contém \`mode=preview_only\`, \`status=ok|blocked\`, \`would_expire_count\`, \`would_expire_bytes\` e \`deleted_count=0\`. O valor \`would_expire_count\` é uma estimativa, não uma autorização de exclusão. Uma prévia bloqueada é esperada enquanto houver menos de 14 backups registrados.

## Antes de uma política de expiração real

A implementação atual **não inclui expurgo**. Para uma futura autorização separada, é necessário verificar a primeira execução automática do cron, confirmar snapshots nativos do volume, documentar e testar recuperação independente do S3, configurar alertas e estabelecer aprovação explícita para exclusão permanente. Cópias antigas ainda podem ser úteis para recuperação em incidentes descobertos tardiamente.

O custo de armazenamento poderá aumentar enquanto a limpeza estiver desativada. Por segurança, não são usados comandos \`delete-object\`, \`delete-objects\` ou lifecycle automático.
