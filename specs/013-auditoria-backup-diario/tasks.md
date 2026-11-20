# Checklist · Auditoria diária de backups

- [x] Calcular fronteira do último cron 03:20 UTC com casos de virada.
- [x] Criar endpoint sem metadados e com acesso apenas na demo.
- [x] Criar testes de resposta e janela temporal.
- [x] Validar CI da alteração.
- [x] Publicar API na Railway com deploy bem-sucedido.
- [ ] Confirmar o endpoint por verificação HTTP externa do novo workflow.
- [x] Criar monitor GitHub Actions às 08h30 UTC com issue independente.
- [ ] Observar o primeiro ciclo agendado e conferir logs da simulação S3.
- [ ] Configurar snapshots nativos do volume PostgreSQL no painel.

## 014 · Recuperação do arquivo armazenado

- [x] Adicionar segunda restauração isolada do objeto baixado do S3 e comparação estrutural.
- [x] Atualizar verificações do workflow de imagem e o guia de backups.
- [ ] Confirmar compilação da nova imagem.
- [ ] Implantar no serviço de backup e validar execução com dados fictícios reais da demo.
- [ ] Verificar execução automática do cron, retenção e snapshot nativo do volume.
