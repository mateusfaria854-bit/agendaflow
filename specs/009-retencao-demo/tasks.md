# Tarefas · Retenção da demo

## Entrega verificada

- [x] Modelar elegibilidade segura com limites e verificação do modo demo.
- [x] Construir simulação de somente leitura.
- [x] Implementar transação, trava, lote, auditoria e remoção de registros associados.
- [x] Escrever testes contra PostgreSQL descartável.
- [ ] Confirmar aprovação de todos os workflows do commit final.

## Operação antes de automatizar

- [x] Configurar backup lógico independente diário do PostgreSQL da Railway em bucket privado.
- [x] Restaurar o dump real em banco temporário e verificar o download íntegro do objeto S3.
- [ ] Habilitar snapshots automáticos nativos do volume no painel da Railway.
- [ ] Definir retenção do bucket, alertas e ensaio operacional de recuperação.
- [ ] Habilitar cron de limpeza apenas após backup e validação da política de retenção.
- [ ] Acompanhar logs agregados e métricas, sem expor usuários.
