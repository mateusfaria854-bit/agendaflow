# Tarefas · Retenção da demo

## Entrega verificada

- [x] Modelar elegibilidade segura com limites e verificação do modo demo.
- [x] Construir simulação de somente leitura.
- [x] Implementar transação, trava, lote, auditoria e remoção de registros associados.
- [x] Escrever testes contra PostgreSQL descartável.
- [ ] Confirmar aprovação de todos os workflows do commit final.

## Operação antes de automatizar

- [ ] Configurar backup automático do volume PostgreSQL da Railway.
- [ ] Testar restauração a partir de um backup do ambiente hospedado.
- [ ] Habilitar cron de limpeza apenas após backup e validação da política de retenção.
- [ ] Acompanhar logs agregados e métricas, sem expor usuários.
