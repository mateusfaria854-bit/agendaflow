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

## Fase 1: cadastrar e administrar serviços

Depois de subir o PostgreSQL e aplicar as migrações, o catálogo público da interface mostra os serviços fictícios do seed. Contas públicas são sempre do tipo **CLIENTE**, sem permissão para administrar o sistema.

Para criar o primeiro administrador, use uma conta de e-mail **ainda não cadastrada** no AgendaFlow. No PowerShell, defina as variáveis temporárias:

```powershell
$env:ADMIN_NAME = "Administrador Local"
$env:ADMIN_EMAIL = "admin-local@example.invalid"
$secret = Read-Host "Senha forte do administrador (12+ caracteres)" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $secret).Password
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
Remove-Item Env:ADMIN_EMAIL
Remove-Item Env:ADMIN_NAME
```

O endereço acima é um exemplo fictício; o usuário administrador deve utilizar um e-mail exclusivo. A senha não é gravada no repositório. O comando **não promove** contas existentes e não possui senha padrão. Em produção é necessário configurar HTTPS, `NODE_ENV=production` e `WEB_ORIGIN`, além de monitoramento e limitação distribuída de tentativas.

Na interface, entre com o usuário administrador para criar, editar e desativar serviços e profissionais. Os dados são persistidos no PostgreSQL local. **Não há agendamentos reais nesta fase.**

`GET /api/v1/health` continua público, `GET /api/v1/auth/me` exige sessão válida e operações de catálogo exigem ADMIN.

## Fase 2: configurar agenda e consultar horários

Entre com o administrador no painel e selecione um profissional na seção **Gestão de horários**. É possível:

- Definir vários turnos por dia, como 09:00–12:00 e 13:00–18:00; dias não cadastrados ficam indisponíveis.
- Registrar folgas ou pausas excepcionais com data/hora de início e fim.
- Remover bloqueios futuros previamente cadastrados.

No **catálogo público**, selecione um serviço, um profissional habilitado e uma data até 90 dias no futuro e clique em **Consultar horários**. A API retorna os horários livres sem registrar reservas. A duração do serviço, os bloqueios e as reservas ativas são considerados no cálculo.

O backend usa `BUSINESS_TIMEZONE=America/Sao_Paulo` por padrão. Configure essa variável em `apps/api/.env` se o negócio operar em outro fuso IANA. As datas enviadas por formulário `datetime-local` são interpretadas no fuso do dispositivo do administrador; a interface exibe essa distinção. Horários que cruzem mudanças de offset não são oferecidos na Fase 2.

Exemplo de consulta pública:

```text
GET http://127.0.0.1:3333/api/v1/availability/slots?professionalId=UUID&serviceId=UUID&date=2035-01-01
```

O endpoint valida datas e limita consultas a hoje + 90 dias. O PostgreSQL continua exigindo migrações e seed via `npm run db:migrate` e `npm run db:seed`. Não foi necessária migração nova na Fase 2 porque as tabelas de disponibilidade e bloqueios já existiam desde a Fase 0.
