# Tarefas · Retenção dos backups

- [x] Especificar prazo mínimo de 30 dias e preservação das 14 últimas cópias.
- [x] Implementar inventário somente leitura com paginação e falha segura.
- [x] Criar testes de datas, prefixos, limites e opção de exclusão recusada.
- [x] Integrar simulação ao serviço de backup sem apagar arquivos.
- [x] Confirmar testes Python e CI Docker e publicação da nova imagem no Railway (cronReady).
- [ ] Confirmar a primeira prévia real após a próxima execução automática do cron diário.
- [ ] Verificar a primeira execução automática do backup com a nova imagem.
- [ ] Configurar snapshots nativos do volume PostgreSQL e restauração independente.
- [ ] Avaliar com aprovação específica uma futura política de exclusão, mantendo a última cópia íntegra e várias gerações de recuperação.
