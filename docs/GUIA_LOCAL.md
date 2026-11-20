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

O Vite encaminha `/api` para o servidor local. A capa apresenta uma prévia visual conceitual, mas cadastro/login, catálogo, disponibilidade, reservas e painel administrativo já funcionam no ambiente local com PostgreSQL.

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

## Fase 3: criar e cancelar reservas

Com a API, frontend e PostgreSQL ligados, crie uma conta **CLIENTE** pelo formulário na interface. Na seção **Encontre seu próximo horário**, escolha o serviço, profissional e data e clique em **Consultar horários**. Clique num dos horários disponíveis e confirme o agendamento.

A reserva é validada novamente no servidor, que verifica expediente, bloqueios, duração, vínculo serviço/profissional e conflitos sob transação PostgreSQL. Se outra pessoa reservar primeiro, a resposta é **409**, e a interface permite consultar outro horário.

A seção **Meus agendamentos**, visível somente para clientes autenticados, apresenta as últimas 50 reservas e permite cancelar atendimentos futuros. O cancelamento muda o status para `CANCELADO`, sem apagar o histórico, e libera o horário no catálogo. O administrador tem gestão do catálogo e expediente; uma agenda administrativa completa será entregue na Fase 4.

APIs principais:

```text
POST  /api/v1/appointments             {professionalId,serviceId,startsAt}
GET   /api/v1/appointments/mine        Cookie de sessão CLIENTE
PATCH /api/v1/appointments/:id/cancel  Cookie de sessão CLIENTE titular
```

O início deve ser um timestamp UTC ISO 8601 retornado na consulta de slots; preço, término e identidade do cliente não podem ser definidos no payload. **Não há pagamentos nem notificações automáticas.** Os testes de concorrência e autorização são executados pelo GitHub Actions com PostgreSQL descartável.

## Fase 4: calendário e reservas manuais

Entre com o usuário ADMIN. No fim do painel de administração, abra **Calendário de atendimentos**:

- Filtre por início/fim de período de até 31 dias, profissional e status. A agenda apresenta até 100 resultados por página e botões para avançar.
- Pesquise clientes existentes por nome/e-mail (mínimo três caracteres). Contas de cliente devem ser cadastradas pelo próprio cliente antes da reserva manual.
- Escolha um serviço ativo, profissional habilitado e data; consulte os slots e confirme uma reserva manual em nome do cliente.
- Confirme reservas PENDENTE futuras, cancele reservas ativas futuras ou conclua atendimentos CONFIRMADO somente após o término.

As reservas manuais passam pela mesma validação transacional da reserva do cliente. Mudanças de estado deixam evento de auditoria. A pesquisa de clientes retorna dados pessoais **somente para ADMIN**; não use clientes reais em demonstrações públicas.

Endpoints:

```text
GET   /api/v1/admin/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&professionalId=UUID&status=CONFIRMADO&offset=0
GET   /api/v1/admin/clients?query=texto
POST  /api/v1/admin/appointments
PATCH /api/v1/admin/appointments/:id/status
```

Não há migração nova nesta fase; os dados já são suportados pelas tabelas `appointments` e `audit_events` iniciais. Os testes E2E de navegador, revisão de segurança final e deploy demonstrativo ficam para a Fase 5.

## Complemento da Fase 4: criar login de profissional

No painel ADMIN, cadastre um profissional e copie o **ID para provisionar conta** exibido na lista administrativa. O cadastro público cria somente CLIENTE. Para habilitar o acesso de um profissional, abra o PowerShell no diretório do AgendaFlow com PostgreSQL funcionando e defina as variáveis temporárias (substitua o ID pela UUID real do profissional):

```powershell
$env:PROFESSIONAL_ID = "00000000-0000-0000-0000-000000000001"
$env:STAFF_NAME = "Profissional Local"
$env:STAFF_EMAIL = "profissional-local@example.invalid"
$secret = Read-Host "Senha forte do profissional (12+ caracteres)" -AsSecureString
$env:STAFF_PASSWORD = [System.Net.NetworkCredential]::new("", $secret).Password
npm run staff:provision
Remove-Item Env:STAFF_PASSWORD
Remove-Item Env:STAFF_EMAIL
Remove-Item Env:STAFF_NAME
Remove-Item Env:PROFESSIONAL_ID
```

O ID e o e-mail acima são apenas exemplos, não são uma conta pronta. Não use credenciais reais nem coloque a senha nos arquivos versionados. O comando falha sem um profissional existente, se o e-mail já estiver cadastrado ou se houver conta associada. Não promove contas CLIENTE/ADMIN existentes.

Após executar o provisionamento, faça login pelo formulário normal com o e-mail e a senha definidos. O papel PROFISSIONAL verá **Seus atendimentos, com privacidade**, com filtros de data/status e paginação. Esta área não permite alterar reservas e não revela dados financeiros ou e-mails de clientes. Somente o administrador gerencia status e reservas manuais.

```text
GET /api/v1/staff/me
GET /api/v1/staff/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&status=CONFIRMADO&offset=0
```

A associação depende da coluna `professionals.user_id`, que já existia desde a migração inicial. Nenhuma alteração do schema foi necessária. Revise a segurança e realize testes E2E em navegador antes de qualquer publicação externa.

## Fase 5: Playwright e acessibilidade

O workflow `.github/workflows/e2e.yml` executa os testes E2E em uma instância CI isolada e descarta PostgreSQL e contas fictícias após a execução. Para usar localmente:

```bash
npm install
npx playwright install chromium
npm run dev:api
# Em outro terminal:
npm run dev:web
# Com ambos funcionando, em um terceiro terminal:
npm run test:e2e
```

No ambiente local, as verificações que exigem admin/profissional são ignoradas caso `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` ou `E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD` não estejam definidos. No GitHub Actions, essas contas são criadas pelo pipeline com dados totalmente fictícios. Nunca rode `test:e2e` apontando para banco real ou produção.

O Playwright cobre Chromium desktop e emulação de celular. A checagem automatizada WCAG com axe examina o painel de autenticação; outros componentes devem passar também por testes manuais com leitores de tela e navegação real por teclado.

## Preparar a publicação demonstrativa

Consulte [DEPLOY_DEMO.md](DEPLOY_DEMO.md). São necessários origem HTTPS, proxy único para frontend e `/api/v1`, PostgreSQL privado, backups verificáveis e segredos fora do repositório. O código não contém credenciais de produção nem site público já implantado.
