# 011 · Retenção segura das cópias privadas

## Objetivo
Preparar uma política de retenção dos dumps fictícios no bucket privado da Railway, sem apagar nenhum backup na entrega atual.

## Requisitos
- Somente consulta de `list-objects-v2` no prefixo fixo `agendaflow/demo/daily/`, com paginação e limite de inventário.
- Prévia calculada por data real do objeto S3, nunca confiando apenas no nome.
- Preservar pelo menos **30 dias** e as **14 cópias mais recentes**, mesmo que antigas.
- Se a cópia mais nova tiver mais de 36 horas, o inventário for incompleto ou houver objetos desconhecidos, bloquear a prévia de expiração.
- Rejeitar `--execute`: nenhuma API de exclusão de objetos deverá ser implementada agora.
- Não imprimir identificadores de objetos, credenciais, endpoints nem conteúdo do backup nos logs.
- O job real roda a simulação só após restaurar e recuperar o backup do armazenamento.
- Não alterar o cron diário, nem habilitar expurgo de contas ou de backups.

## Critérios de aceitação
- Testes com inventário fictício validam prefixo, paginação, proteção das 14 últimas, intervalo mínimo e falha segura.
- A imagem Docker compila e carrega o utilitário.
- A execução real registra contagens sem alterar ou apagar objetos.
- README e guia operacional distinguem simulação de expurgo efetivo.
