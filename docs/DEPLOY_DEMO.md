# Implantação demonstrativa: guia operacional

> **Status (20/11/2026):** a demonstração foi implantada na Railway e o smoke test externo de DNS/TLS, frontend, API e PostgreSQL passou no GitHub Actions. URL de demo: [AgendaFlow](https://agendaflow-web-production.up.railway.app/). **Ambiente demonstrativo, não adequado a dados reais de clientes.**

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

## Railway: implantação executada e configuração de referência

Configuração aplicada em `agendaflow-demo`, ambiente `production`: um serviço `agendaflow-web` originado de `mateusfaria854-bit/agendaflow` (branch `main`) e um serviço privado `Postgres` com volume persistente. A API e o site React compartilham a mesma origem HTTPS. O domínio da Railway está direcionado à porta interna que a aplicação escuta (`8080`, atribuída pela Railway), e o healthcheck usa `/api/v1/ready`.

O serviço web define `DATABASE_URL` como referência a `${{Postgres.DATABASE_URL}}` no painel (sem publicar a senha), além de `NODE_ENV=production`, `SERVE_WEB=true`, `HOST=0.0.0.0`, `BUSINESS_TIMEZONE=America/Sao_Paulo`, `DEMO_MODE=true` e `WEB_ORIGIN=https://agendaflow-web-production.up.railway.app`. O pre-deploy executa `npm run db:demo:bootstrap`, que aplica migrações e seed fictício idempotente. **Não usar esse seed automaticamente em bancos reais.**

O workflow [Disponibilidade da demo HTTPS](../.github/workflows/demo-uptime.yml) verifica externamente a resolução DNS, TLS, `/api/v1/health`, `/api/v1/ready`, frontend e favicon a cada 6 horas e pode ser acionado manualmente. O primeiro teste de 20/11/2026 passou; a disponibilidade futura depende do provedor, da rede e das próximas versões.

### Verificação operacional ainda necessária

- Definir retenção e expurgo automático de contas e agendamentos de demonstração, com política para sessões expiradas.
- Configurar backup automático e **testar a restauração em ambiente isolado**; o volume persistente sozinho não equivale a backup.
- Adicionar limites de abuso adequados a múltiplas réplicas e proteger rotas sensíveis contra tráfego excessivo.
- Configurar alertas operacionais e monitoramento de recursos e erros; o teste agendado de disponibilidade é apenas uma verificação periódica.
- Revisar a conformidade LGPD e manter a demo restrita a informações fictícias.

## Caminho sugerido: Railway com um único serviço web e PostgreSQL gerenciado

O repositório possui `Dockerfile` na raiz e não usa configuração Railway descontinuada. A imagem serve **React e Fastify no mesmo serviço web**, portanto é necessário apenas um serviço de aplicação e um serviço PostgreSQL separado.

1. Conecte o repositório `mateusfaria854-bit/agendaflow` ao projeto Railway. Configure a origem GitHub para seguir a branch `main`, com root directory na **raiz** do monorepo. Não realize o primeiro deploy sem as variáveis de ambiente e o banco.
2. Adicione um banco PostgreSQL gerenciado pelo provedor, mantendo a conexão na rede privada do projeto. Configure a variável `DATABASE_URL` no serviço web como referência ao `DATABASE_URL` do serviço PostgreSQL, usando a interface de variáveis do Railway. Evite expor o banco à internet.
3. Configure as variáveis do serviço web: `NODE_ENV=production`, `SERVE_WEB=true`, `HOST=0.0.0.0`, `BUSINESS_TIMEZONE=America/Sao_Paulo`, `DEMO_MODE=true` e `WEB_ORIGIN=https://DOMINIO_PUBLICO_VALIDO`. O valor de `PORT` será fornecido pelo provedor, não fixe um valor conflitante.
4. Gere/configure o domínio HTTPS do serviço web no painel do provedor. Só então defina `WEB_ORIGIN` com a origem exata do domínio, sem barra no fim, antes de liberar o site. Se o provedor fornecer a variável `RAILWAY_PUBLIC_DOMAIN`, ela contém apenas o hostname, então use o prefixo `https://`.
5. Configure o comando **pre-deploy** da aplicação como `npm run db:migrate:runtime -w @agendaflow/api && npm run db:seed:runtime -w @agendaflow/api` somente no **banco descartável da demonstração**. O seed é idempotente e nunca cria usuários/senhas padrão. Em ambiente real, remova o seed do pre-deploy.
6. Defina o healthcheck como `/api/v1/ready`. A aplicação só ficará pronta quando conectar ao PostgreSQL. Depois verifique `/api/v1/health`, `/api/v1/ready`, `/`, `/favicon.svg` e o fluxo de reserva/cancelamento sob HTTPS.
7. Configure limites contra abuso e monitoramento externo, faça teste de backup/restauração e defina política de expurgo/reset das contas e reservas de demonstração. Não publique a URL no README até tudo passar.

### Comandos de runtime dentro da imagem

Os scripts compilados funcionam sem `tsx`, removido do contêiner final:

```bash
npm run db:migrate:runtime -w @agendaflow/api
npm run db:seed:runtime -w @agendaflow/api
```

Para criar contas ADMIN/PROFISSIONAL fictícias em ambiente controlado, configure as variáveis exigidas pelo CLI e execute `npm run admin:create:runtime -w @agendaflow/api` ou `npm run staff:provision:runtime -w @agendaflow/api`. Nunca coloque essas senhas no Dockerfile, em commits, na URL ou no README.

### Proteção do modo demo

Com `DEMO_MODE=true`, o cadastro de clientes rejeita e-mails fora de `@example.invalid` e aplica um limite simples de **5 tentativas por IP a cada 15 minutos** na memória da instância (HTTP 429 em excesso). O usuário deve utilizar nomes fictícios e uma senha descartável, nunca sua senha pessoal. O limite em memória não é distribuído entre réplicas e, por depender do IP visto pelo servidor atrás de um proxy, pode agrupar visitantes sob o mesmo endereço; uma proteção de borda ou store compartilhado continua necessária para operação pública de longo prazo. O modo demo não garante anonimização completa, não impede abuso automatizado e não implementa expurgo automático. **Não abra o serviço para o público antes de definir retenção, limitação de requisições e monitoramento.**

### Validação antes de compartilhar a URL

O workflow [Container de demonstração](../.github/workflows/container-demo.yml) valida a imagem Docker, o frontend, o endpoint `/api/v1/health`, o 404 de API e a proteção de origem. O workflow [E2E](../.github/workflows/e2e.yml) testa a experiência com PostgreSQL descartável no CI. Nenhum deles substitui conferir o site publicado em HTTPS, o healthcheck, o backup e a disponibilidade contínua.
