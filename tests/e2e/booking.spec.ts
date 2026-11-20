import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function businessDate(value:Date):string{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(value).map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function futureWorkingDate(){
  for(let delta=10;delta<20;delta++){
    const date=new Date(Date.now()+delta*86_400_000);
    const day=new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Sao_Paulo',weekday:'short',
    }).format(date);
    if(['Mon','Tue','Wed','Thu','Fri'].includes(day))return businessDate(date);
  }
  throw new Error('Nenhum dia útil encontrado para o teste');
}
const password='SenhaFicticiaE2E2026!';
async function login(page:import('@playwright/test').Page,email:string,passwordValue:string){
  await page.goto('/#portal');
  await page.locator('.portal-tabs').getByRole('button',{name:'Entrar'}).click();
  const form=page.locator('.portal-panel .portal-form').first();
  await form.getByLabel('E-mail').fill(email);
  await form.getByLabel('Senha').fill(passwordValue);
  await form.getByRole('button',{name:'Entrar na conta'}).click();
}

test('cliente reserva e cancela no navegador, sem reservas duplicadas',async({page},testInfo)=>{
  const email=`cliente-${testInfo.project.name}-${Date.now()}@example.invalid`;
  await page.goto('/#portal');
  await expect(page.locator('.portal-catalog .portal-service-grid').getByRole('heading',{name:'Corte clássico',exact:true})).toBeVisible();
  await page.locator('.portal-tabs').getByRole('button',{name:'Criar conta'}).click();
  const form=page.locator('.portal-panel .portal-form').first();
  await form.getByLabel('Nome completo').fill('Cliente E2E Fictício');
  await form.getByLabel('E-mail').fill(email);
  await form.getByLabel('Senha').fill(password);
  await form.getByRole('button',{name:'Cadastrar cliente'}).click();
  await expect(page.getByRole('heading',{name:/Olá, Cliente E2E Fictício/})).toBeVisible();
  await expect(page.locator('#minhas-reservas')).toBeVisible();

  const availability=page.locator('#horarios');
  await availability.getByLabel('Serviço').selectOption({label:'Corte clássico · 30 min'});
  await availability.getByLabel('Profissional').selectOption({label:'Pat Demo'});
  await availability.getByLabel('Data').fill(futureWorkingDate());
  await availability.getByRole('button',{name:'Consultar horários'}).click();
  await expect(availability.locator('.af-booking-slot').first()).toBeVisible();
  await availability.locator('.af-booking-slot').first().click();
  await availability.getByRole('button',{name:'Confirmar agendamento'}).click();
  await expect(availability.getByRole('status')).toContainText('Agendamento confirmado');
  const own=page.locator('#minhas-reservas');
  await expect(own.getByText('Corte clássico')).toBeVisible();
  await expect(own.getByText('Pat Demo')).toBeVisible();
  await page.once('dialog',dialog=>dialog.accept());
  await own.getByRole('button',{name:'Cancelar'}).click();
  await expect(own.locator('.af-booking-date small').filter({hasText:/^Cancelado$/})).toBeVisible();
  await expect(own.getByText('Corte clássico')).toBeVisible();
  const response=await page.request.get('/api/v1/admin/appointments?from=2026-11-01&to=2026-11-01');
  expect(response.status()).toBe(403);
  await page.getByRole('button',{name:'Sair da conta'}).click();
  await expect(page.getByRole('heading',{name:'Seu espaço começa aqui.'})).toBeVisible();
});

test('área de autenticação aceita navegação por teclado e passa verificações WCAG',async({page})=>{
  await page.goto('/#portal');
  await expect(page.getByRole('heading',{name:'Seu espaço começa aqui.'})).toBeVisible();
  await page.locator('.portal-tabs').getByRole('button',{name:'Criar conta'}).focus();
  await expect(page.locator('.portal-tabs').getByRole('button',{name:'Criar conta'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.portal-form').getByLabel('Nome completo')).toBeVisible();
  const report=await new AxeBuilder({page})
    .include('.portal-grid')
    .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])
    .analyze();
  expect(report.violations,JSON.stringify(report.violations,null,2)).toEqual([]);
});

test('painel administrativo está protegido e permite consulta filtrada',async({page})=>{
  const email=process.env.E2E_ADMIN_EMAIL;
  const secret=process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email||!secret,'Configure as credenciais fictícias E2E_ADMIN_* para este teste.');
  await login(page,email!,secret!);
  await expect(page.locator('#admin-calendario')).toBeVisible();
  await expect(page.locator('#admin-calendario').getByRole('heading',{name:'Calendário de atendimentos.'})).toBeVisible();
  const status=page.locator('#admin-calendario').locator('.admin-calendar-filters');
  await status.getByLabel('Status').selectOption('CONFIRMADO');
  await status.getByRole('button',{name:'Aplicar filtros'}).click();
  await expect(page.locator('#admin-calendario').getByText('Atendimentos do período')).toBeVisible();
});

test('profissional vê sua própria agenda e não acessa administração',async({page})=>{
  const email=process.env.E2E_STAFF_EMAIL;
  const secret=process.env.E2E_STAFF_PASSWORD;
  test.skip(!email||!secret,'Configure as credenciais fictícias E2E_STAFF_* para este teste.');
  await login(page,email!,secret!);
  await expect(page.locator('#minha-agenda-profissional')).toBeVisible();
  await expect(page.locator('#minha-agenda-profissional').getByText('Alex Demo')).toBeVisible();
  const forbidden=await page.request.get('/api/v1/admin/clients?query=demo');
  expect(forbidden.status()).toBe(403);
});
