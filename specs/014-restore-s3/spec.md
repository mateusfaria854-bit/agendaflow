# 014 · Restauração independente do dump armazenado

## Objetivo
Garantir que o arquivo recuperado do bucket privado S3 possa ser restaurado em PostgreSQL isolado, antes de registrar sucesso no monitor da demo.

## Requisitos
- Manter dump e restauração inicial em PostgreSQL temporário, sem restaurar no banco hospedado.
- Após upload, leitura do objeto e comparação byte a byte, restaurar o arquivo baixado do S3 em **outro banco novo e descartável**.
- Conferir migrações, usuários, serviços, profissionais, agendamentos, sessões e a restrição contra conflitos.
- Em qualquer falha, encerrar com erro sem atualizar o heartbeat do backup e apagar arquivos/processos temporários.
- Não revelar chaves do bucket, credenciais ou dados individuais.
- Não modificar o agendamento cron, expurgo de contas ou política de retenção de objetos.

## Critérios de aceitação
- CI de imagem Docker e testes existentes aprovados.
- Nova imagem implantada somente após validação.
- Execução real da demo registra mensagem de segunda restauração aprovada e monitor de backup recente continua saudável.
