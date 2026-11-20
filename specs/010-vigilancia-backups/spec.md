# 010 · Alerta de backup recente da demonstração

## Objetivo
Detectar automaticamente cópias diárias não executadas, ausentes ou antigas sem expor segredos, arquivos nem identificadores do armazenamento.

## Requisitos
- Uma migração cria registro mínimo de backup verificado, sem bucket, chave de objeto ou senha.
- O job só grava o registro após restaurar o dump e conferir o download do bucket byte a byte.
- Endpoint GET /api/v1/backups/ready disponível somente em DEMO_MODE=true.
- Resposta 200 {status:fresh} para backup de até 36h, e 503 {status:unavailable} nos demais casos.
- A checagem não muda o /api/v1/ready usado pelo deploy.
- No GitHub, o monitor externo terá uma fase dedicada para alertar quando o backup estiver atrasado.
- Nenhum job de limpeza ou exclusão automática será habilitado nesta etapa.

## Critérios de aceitação
- Migração e suíte de backup-restauração passam em CI.
- Testes unitários validam limite de 36h e ocultação de dados.
- Uma cópia real do banco é validada e registra o heartbeat.
- Após a cópia, a rota pública responde com status fresh.
- A checagem HTTPS detecta 503 e abre incidente se o backup ficar antigo.
