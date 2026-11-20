# Checklist · Auditoria diária de backups

- [x] Calcular fronteira do último cron 03:20 UTC com casos de virada.
- [x] Criar endpoint sem metadados e com acesso apenas na demo.
- [x] Criar testes de resposta e janela temporal.
- [ ] Validar CI da alteração.
- [ ] Publicar API na Railway e confirmar acesso externo.
- [ ] Criar monitor GitHub Actions às 08:30 UTC com issue independente.
- [ ] Observar o primeiro ciclo agendado e conferir logs da simulação S3.
- [ ] Configurar snapshots nativos do volume PostgreSQL no painel.
