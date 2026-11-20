# Plano técnico · Verificação de recuperação S3

Modificar somente `ops/backup/backup.sh` e os guardrails de `.github/workflows/backup-image.yml`. Após a primeira restauração e antes de registrar o heartbeat, manter o servidor PostgreSQL temporário ativo, recuperar o arquivo do S3, restaurá-lo em outra base isolada e comparar as contagens de tabelas essenciais. Desligar o servidor temporário por `pg_ctl` quando os testes passarem, e por `trap` em qualquer erro.

Atualizar documentação de backup e checklist. A execução real posterior deve ser conferida em logs sem listar dumps, contas ou segredos. O cron permanece no mesmo agendamento; não executar limpeza destrutiva.
