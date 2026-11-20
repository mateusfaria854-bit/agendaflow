# Plano técnico · Observabilidade do backup

O servidor Fastify expõe um endpoint read-only isolado com a mesma política de proteção de cache do restante da API. A infraestrutura não recebe credenciais S3 no serviço web: o cron de backup consulta Postgres pelo DATABASE_URL privado e registra apenas data, tamanho e SHA256 do arquivo verificado. A API retorna somente um estado binário para o monitor externo.

Implementar a migração 0004_backup_verification.sql antes de reiniciar o backup, com tabela de uma linha (id=1). Após o job realizar pg_restore em servidor isolado e verificar a cópia baixada do bucket, ele atualiza a linha via UPSERT. Não registrar estados positivos antes do objeto privado estar íntegro.

Ativar a regra externa de alarme somente quando o primeiro heartbeat estiver registrado; usar janela de 36 horas para tolerar atrasos moderados da agenda diária. Não modificar healthcheck de readiness de deploy nem alterar a política de retenção de dados dos clientes.
