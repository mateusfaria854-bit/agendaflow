# Plano técnico · Retenção de backups

Criar `ops/backup/retention.py` com Python 3 padrão e AWS CLI apenas para consulta de objetos. A imagem atual do backup recebe o utilitário e o executa após o `pg_restore` isolado, o download do objeto no S3 e o registro da última cópia verificada.

O processo consulta no máximo 10 mil objetos do prefixo estrito usando páginas. Metadados inválidos, objetos não reconhecidos, paginação incompleta, backup recente ausente e menos de 14 cópias bloqueiam a seleção. Objetos com idade inferior a 30 dias ou entre as 14 cópias mais recentes são sempre preservados. A saída mostra apenas contagens e bytes estimados, sem divulgar chaves S3.

A operação só é permitida em `DEMO_MODE=true` e **não possui qualquer opção de exclusão**; `--execute` retorna erro. Testes unitários usam inventário fictício injetado. O CI inclui os testes e a compilação da imagem. Não programar limpeza real.
