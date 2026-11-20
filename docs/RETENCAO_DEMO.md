# Retenção de dados fictícios e limpeza controlada

> **Estado:** código e testes implementados. As exclusões **não** são executadas nem agendadas automaticamente na Railway. A ativação depende de backup automático e restauração testada do banco hospedado.

## O que a rotina seleciona

Contas com papel `CLIENTE`, e-mail do domínio reservado `@example.invalid`, com criação e última atividade de pelo menos **30 dias** e sem agendamentos recentes/futuros, sessões recentes/ativas ou eventos de auditoria recentes. O limite padrão é 50 contas por execução, até 100 no máximo. Contas `ADMIN` e `PROFISSIONAL` são excluídas da seleção.

A migração `0003_activity_tracking.sql` cria `last_activity_at`, atualizado na abertura e encerramento de sessões. Contas existentes recebem uma nova janela de 30 dias a partir da migração, evitando remoção imediata de usuários já cadastrados.

## Simulação obrigatória antes de qualquer exclusão

Execute primeiro **somente** com um banco de testes e com `DEMO_MODE=true`:

```bash
DEMO_MODE=true npm run db:demo:cleanup:preview
```

O programa imprime apenas contagens de contas elegíveis, sessões expiradas e agendamentos associados, sem nomes, e-mails nem tokens. **O comando acima não escreve no banco.** Também existe versão compilada para o contêiner: `npm run db:demo:cleanup:runtime -w @agendaflow/api`.

## Exclusão real: desativada por padrão

Somente depois que o backup automático do **Postgres da Railway** estiver habilitado e uma restauração **desse backup** tiver sido testada em ambiente isolado, o operador poderá autorizar:

```bash
DEMO_MODE=true DEMO_MAINTENANCE_ENABLED=true npm run db:demo:cleanup -w @agendaflow/api -- --execute
```

**Não execute esse comando na Railway enquanto a verificação de backup real estiver pendente.** A rotina usa transação, limite por lote, bloqueio de concorrência, rollback e exclusão ordenada de auditoria, sessões, reservas e contas. Também limpa sessões expiradas.

Configurações: `DEMO_RETENTION_DAYS` (30 a 365, padrão 30) e `DEMO_CLEANUP_BATCH` (1 a 100, padrão 50). Uma segunda execução é idempotente para o mesmo lote. Use sempre dados fictícios.

## Backup hospedado: pendência da etapa 2

O workflow `backup-restore.yml` valida o procedimento de dump e restauração em **bancos descartáveis de CI**. Isso não cria backups do banco real na Railway.

No painel Railway, abra o serviço **Postgres**, localize as opções de **Backups** do volume persistente, configure cópias automáticas e retenção, e realize restauração em **novo ambiente isolado**. Não restaure sobre o serviço de produção. Confira a documentação oficial de [volume backups](https://docs.railway.com/volumes/backups) e [PostgreSQL](https://docs.railway.com/databases/postgresql). A ativação de exclusões permanece pendente até essa validação.
