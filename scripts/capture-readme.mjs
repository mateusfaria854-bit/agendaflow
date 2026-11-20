// Capturas reais para o README, executadas somente contra um ambiente de teste descartável.
// Sem dados de clientes reais e sem alterar a instância pública.
import {chromium, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
const root = 'docs/media';
const frames = join(root, 'frames');
await mkdir(frames, {recursive:true});

function nextWorkingDay() {
  const formatter = new Intl.DateTimeFormat('en-GB',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
    weekday:'short'
  });
  for (let d=10;d<20;d++) {
    const parts=Object.fromEntries(formatter.formatToParts(new Date(Date.now()+d*86_400_000)).map(x=>[x.type,x.value]));
    if(['Mon','Tue','Wed','Thu','Fri'].includes(parts.weekday)) {
      return `${parts.year}-${parts.month}-${parts.day}`;
    }
  }
  throw new Error('Não foi encontrado dia útil para a captura.');
}

async function align(page, selector) {
  await page.evaluate(selector=>{
    const el=document.querySelector(selector);
    if(!el)throw new Error('Element not found: '+selector);
    window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-26,behavior:'instant'});
  },selector);
  await page.waitForTimeout(240);
}

let frame=0;
async function shot(page, filename,selector) {
  if(selector)await align(page,selector);
  await page.screenshot({path:join(root,filename),type:'jpeg',quality:82,animations:'disabled',caret:'hide'});
}
async function gifFrame(page,selector) {
  if(selector)await align(page,selector);
  await page.screenshot({
    path:join(frames,`flow-${String(frame++).padStart(2,'0')}.png`),
    animations:'disabled',caret:'hide'
  });
}

const browser=await chromium.launch({headless:true});
try {
  const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'reduce'});
  const page=await desktop.newPage();
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.portal-catalog .portal-service-grid').getByRole('heading',{name:'Corte clássico',exact:true})).toBeVisible();
  await shot(page,'01-inicio.jpg');

  await gifFrame(page,'.portal-grid');
  await shot(page,'02-catalogo.jpg','.portal-grid');

  await page.locator('.portal-tabs').getByRole('button',{name:'Criar conta'}).click();
  const form=page.locator('.portal-panel .portal-form').first();
  await form.getByLabel('Nome completo').fill('Cliente de Demonstração');
  await form.getByLabel('E-mail').fill(`captura-${Date.now()}@example.invalid`);
  await form.getByLabel('Senha').fill('SenhaApenasParaTesteCI2026!');
  await gifFrame(page,'.portal-grid');
  await form.getByRole('button',{name:'Cadastrar cliente'}).click();
  await expect(page.getByRole('heading',{name:/Olá, Cliente de Demonstração/})).toBeVisible();
  await gifFrame(page,'.portal-grid');

  const availability=page.locator('#horarios');
  await availability.getByLabel('Serviço').selectOption({label:'Corte clássico · 30 min'});
  await availability.getByLabel('Profissional').selectOption({label:'Pat Demo'});
  const date=nextWorkingDay();
  await availability.getByLabel('Data').fill(date);
  await availability.getByRole('button',{name:'Consultar horários'}).click();
  await expect(availability.locator('.af-booking-slot').first()).toBeVisible();
  await gifFrame(page,'#horarios');
  await shot(page,'03-horarios.jpg','#horarios');
  await availability.locator('.af-booking-slot').first().click();
  await expect(availability.getByRole('button',{name:'Confirmar agendamento'})).toBeVisible();
  await gifFrame(page,'#horarios');
  await availability.getByRole('button',{name:'Confirmar agendamento'}).click();
  await expect(availability.getByRole('status')).toContainText('Agendamento confirmado');
  const own=page.locator('#minhas-reservas');
  await expect(own.getByText('Corte clássico')).toBeVisible();
  await gifFrame(page,'#minhas-reservas');
  await shot(page,'04-minhas-reservas.jpg','#minhas-reservas');

  // Contexto separado: o ADMIN não herda o cookie do CLIENTE.
  const adminContext=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'reduce'});
  const admin=await adminContext.newPage();
  await admin.goto(base+'/#portal',{waitUntil:'networkidle'});
  await expect(admin.getByRole('heading',{name:'Seu espaço começa aqui.'})).toBeVisible();
  const login=admin.locator('.portal-panel .portal-form').first();
  await login.getByLabel('E-mail').fill(process.env.E2E_ADMIN_EMAIL ?? 'admin-e2e@example.invalid');
  await login.getByLabel('Senha').fill(process.env.E2E_ADMIN_PASSWORD ?? 'FicticiaSenhaE2EAdministrador2026!');
  await login.getByRole('button',{name:'Entrar na conta'}).click();
  const cal=admin.locator('#admin-calendario');
  await expect(cal.getByRole('heading',{name:'Calendário de atendimentos.'})).toBeVisible();
  await cal.getByLabel('De',{exact:true}).fill(date);
  await cal.getByLabel('Até',{exact:true}).fill(date);
  await cal.getByRole('button',{name:'Aplicar filtros'}).click();
  await expect(cal.locator('.admin-appointment-row').first()).toBeVisible();
  await shot(admin,'05-admin.jpg','#admin-calendario');

  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,colorScheme:'dark',reducedMotion:'reduce'});
  const mob=await mobile.newPage();
  await mob.goto(base+'/',{waitUntil:'networkidle'});
  await mob.evaluate(()=>document.fonts.ready);
  await expect(mob.locator('.portal-catalog .portal-service-grid').getByRole('heading',{name:'Corte clássico',exact:true})).toBeVisible();
  await shot(mob,'06-mobile.jpg');
  await mobile.close();
  await adminContext.close();
  await desktop.close();
  console.log(`Capturas reais geradas: 6 JPGs e ${frame} quadros de GIF.`);
} finally {
  await browser.close();
}
