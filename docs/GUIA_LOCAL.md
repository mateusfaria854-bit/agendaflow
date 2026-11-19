# Executar o AgendaFlow localmente

## Pré-requisitos
Node.js 22 ou superior, npm 10 ou superior e Docker com Compose para PostgreSQL.

## Inicialização

```bash
npm install
cp apps/api/.env.example apps/api/.env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run db:verify
```

No PowerShell, o comando equivalente de cópia é `Copy-Item apps/api/.env.example apps/api/.env`.

O arquivo `.env` é ignorado pelo Git. As credenciais de `compose.yaml` são exclusivamente locais e não são adequadas à produção.

## Desenvolvimento

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev:web
```

- Interface: http://127.0.0.1:5173
- API: http://127.0.0.1:3333/api/v1/health
- Readiness: http://127.0.0.1:3333/api/v1/ready

O Vite encaminha `/api` para o servidor local. A tela inicial é uma prévia visual. Não existem reservas nem contas operacionais ainda.

## Verificações

```bash
npm run spec:check
npm run arch:check
npm run build
npm test
npm run db:verify
```

A primeira execução de `db:verify` exige a migração e o seed. O CI realiza as etapas automaticamente.

## Banco de dados

O volume `agenda_pg_data` mantém os dados entre reinicializações. `docker compose down` interrompe os serviços. `docker compose down -v` **apaga permanentemente o banco local** e só deve ser usado quando a intenção for reinicializar a demonstração.

Novas mudanças de schema devem entrar em um novo arquivo de migração em `apps/api/db/migrations/`; nunca alterar arquivos SQL já aplicados.
