# 009 · Retenção e limpeza controlada da demonstração

## Objetivo
Evitar o acúmulo de contas e reservas fictícias no ambiente público de portfólio, sem alterar dados reais ou apagar agendas ativas.

## Requisitos
- Somente quando a instância estiver em DEMO_MODE=true.
- Execução padrão é **simulação sem escrita**; a execução real exige duas confirmações técnicas: DEMO_MAINTENANCE_ENABLED=true e o parâmetro --execute.
- Conta elegível: papel CLIENTE, e-mail no domínio reservado @example.invalid, criada há pelo menos 30 dias, sem reserva recente/futura, sem sessão recente/ativa e sem auditoria recente. ADMIN e PROFISSIONAL nunca são eliminados.
- Retenção mínima de 30 dias, máxima de 365 dias; lote máximo de 100 clientes por execução.
- Excluir registros vinculados de modo transacional, respeitando FK e auditoria, incluindo sessões expiradas. Se qualquer etapa falhar, reverter tudo.
- Não imprimir nome, e-mail, senha, token, nem listas de usuários em logs.
- Evitar concorrência entre execuções usando advisory lock PostgreSQL.
- **Proibido executar exclusões no banco hospedado sem backups automáticos e restauração testada desse banco.**

## Plano técnico
- Biblioteca PostgreSQL em apps/api/src/db/demo-maintenance.ts e comando CLI em demo-cleanup.ts.
- Consultas SQL parametrizadas, lote de contas travadas com SKIP LOCKED, transação e rollback.
- Teste de integração com PostgreSQL descartável e contas @example.invalid. Nenhuma remoção é agendada automaticamente nesta primeira versão.
- Ativação futura via tarefa cron isolada, somente após configurar e testar backup real do serviço Postgres na Railway.

## Tarefas
- [x] Definir seleção conservadora e prévia sem escrita.
- [x] Implementar transação, travas, limites e saída com contagens.
- [x] Criar testes de segurança e idempotência.
- [ ] Validar backups automáticos e restauração do banco específico da Railway.
- [ ] Habilitar agendamento do expurgo apenas após essa validação.

## Critérios de aceitação

- Modo de simulação informa contagens, sem alterar o banco.
- Uma conta CLIENTE fictícia antiga é eliminada junto com suas dependências se estiver inativa.
- ADMIN, PROFISSIONAL, usuários recentes e usuários com sessão ativa permanecem intactos.
- A segunda execução não causa exclusões adicionais e a rotina falha fechada fora do modo demo.
- O agendamento de exclusões na Railway permanece desligado até existir backup real testado.
