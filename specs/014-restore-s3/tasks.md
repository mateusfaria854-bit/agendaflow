# Checklist · Recuperação do arquivo S3

- [x] Criar segunda restauração PostgreSQL independente dentro do job.
- [x] Comparar contagens essenciais e integridade da restrição contra reservas duplicadas.
- [x] Impedir atualização do heartbeat enquanto a segunda restauração não passar.
- [x] Atualizar workflow de imagem e documentação.
- [x] Validar CI da imagem.
- [x] Executar a nova imagem em modo controlado e confirmar a segunda restauração.
- [x] Confirmar logs de restauração do backup baixado do bucket e registro do monitor.
- [ ] Confirmar publicação estável com cron diário ativo e log agregado de retenção.
