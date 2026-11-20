# Implantação demonstrativa: guia operacional

> **Status:** guia de preparação. Não há URL de produção ou deploy de serviços externos realizado automaticamente. Os dados devem ser fictícios.

## Arquitetura de hospedagem

Utilize uma origem HTTPS única para o site e a API, com reverse proxy:

```text
https://seudominio.example/
  ├── /              React/Vite compilado (apps/web/dist)
  └── /api/v1/*      Proxy interno para Fastify na porta definida
                     └── PostgreSQL privado (conexão TLS)
```

Evite hospedar o frontend estático numa origem diferente da API sem adaptar e revisar a estratégia de cookie, CORS e proteção CSRF. A aplicação atual chama `/api/v1` na mesma origem.

## Ambiente

Pré-requisitos: Node.js 22+, PostgreSQL 16+, TLS válido no reverse proxy, acesso privado ao banco e backup independente. A aplicação usa npm workspaces e o pacote compartilhado `@agendaflow/shared`.

No ambiente de produção, configure variáveis no gerenciador de segredos do provedor, **não** em arquivos versionados:

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | PostgreSQL exclusivo, credencial de menor privilégio e TLS quando aplicável |
| `NODE_ENV=production` | Cookies Secure e exigência de origem HTTPS |
| `WEB_ORIGIN=https://seudominio.example` | Origem HTTPS autorizada para mutações |
| `BUSINESS_TIMEZONE=America/Sao_Paulo` | Zona IANA do negócio |
| `PORT` e `HOST` | Interface interna de escuta da API |

O frontend deve ser servido a partir de `apps/web/dist` e solicitações a `/api/v1` redirecionadas sem alterar os caminhos ao processo Fastify. As rotas internas de aplicação SPA devem cair em `index.html`.

## Checklist de publicação

1. Fazer backup testado do banco de demonstração antes de qualquer migração.
2. Revisar segredos, dependências, permissões e dados sintéticos do seed. Nunca carregar dados reais de clientes numa URL de portfólio.
3. Executar `npm install`, `npm run check`, `npm run db:migrate` e `npm run db:seed` no ambiente isolado; não rodar `db:verify` em produção.
4. Compilar `npm run build` e publicar os arquivos estáticos do Vite no domínio.
5. Iniciar API pelo script `npm run start -w @agendaflow/api`, em rede interna protegida.
6. Verificar `GET /api/v1/health` e `GET /api/v1/ready` através do reverse proxy HTTPS.
7. Confirmar que `Set-Cookie` possui `HttpOnly`, `SameSite=Lax` e `Secure`, e que `Cache-Control: no-store` aparece nas respostas da API.
8. Conferir HTTPS, redirecionamento HTTP→HTTPS, limites de requisição, timeouts, logs sem dados sensíveis e observabilidade do provedor.
9. Executar smoke tests no ambiente demonstrativo com contas inteiramente fictícias, sem apontar o Playwright CI para produção.
10. Publicar URL no README somente depois de verificar o funcionamento do frontend, API e PostgreSQL e configurar medidas contra abuso.

## Backup PostgreSQL

Exemplo para um ambiente sob controle do operador, usando `DATABASE_URL` fornecida de modo seguro:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > agendaflow-backup.dump
```

**Cuidado:** o arquivo contém todos os dados do banco. Criptografe, limite acesso e retenção, e não envie para repositórios públicos.

Para **restaurar**, faça isso em banco de testes isolado, após confirmar backup e credenciais:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL_TESTE" agendaflow-backup.dump
```

Não execute restauração sobre produção sem plano de interrupção e confirmação. Valide integridade, migrações e dados recuperados antes de confiar no backup.

## Rollback

- **Código:** manter imagem/build e commit anterior disponível. Voltar frontend e API para versão compatível com schema após confirmar saúde e integridade.
- **Banco:** as migrações são progressivas e não possuem reversão automática. Não edite migrações já executadas. Uma mudança incompatível exige migração corretiva ou restauração previamente testada, em janela de manutenção.
- **Dados:** nunca presumir que revertendo o código se revertem reservas ou status já gravados.

## Pendências antes de produção real

Política de retenção/eliminação de dados pessoais, recuperação de senha, limitação de requisições entre múltiplas instâncias, revisão jurídica LGPD, proteção contra abuso/cadastro automatizado, backups automáticos com testes de restauração, alertas e auditoria de segurança. O MVP é adequado para demonstração com dados fictícios, não para operar clientes reais sem essas medidas.
