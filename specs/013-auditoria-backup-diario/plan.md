# Plano de execução · Auditoria diária de cópias

Reaproveitar o registro `backup_verifications` da migração 0004. No backend, adicionar um predicado puro que calcule a última janela do agendamento `20 3 * * *` em UTC. Em produção, o endpoint realiza somente SELECT, e expõe 200/503 com uma informação binária.

Criar workflow GitHub Actions independente do monitor de disponibilidade de seis horas, programado para 08:30 UTC diariamente. A janela permite atraso moderado do cron e evita que o alerta de 36 horas esconda uma execução perdida. Usar uma issue com rótulo próprio para não misturar incidentes de site e backup.

Ordem de entrega: implementar backend e testes, esperar CI, implantar API na Railway e verificar o endpoint, depois publicar o workflow. Não consultar os objetos S3 nem escrever no banco durante os testes.
