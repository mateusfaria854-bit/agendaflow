# Checklist · Recuperação do arquivo S3

- [x] Criar segunda restauração PostgreSQL independente dentro do job.
- [x] Comparar contagens essenciais e integridade da restrição contra reservas duplicadas.
- [x] Impedir atualização do heartbeat enquanto a segunda restauração não passar.
- [x] Atualizar workflow de imagem e documentação.
- [ ] Validar CI da imagem.
- [ ] Implantar nova imagem no cron da Railway.
- [ ] Confirmar logs de restauração do backup baixado do bucket e saúde do monitor.
