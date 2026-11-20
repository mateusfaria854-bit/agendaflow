import { useEffect, useState, type FormEvent } from 'react';
import {api} from '../../lib/api.js';
import AvailabilityPanel from '../availability/AvailabilityPanel.js';
import AvailabilityAdmin from '../availability/AvailabilityAdmin.js';
import BookingsPanel from '../appointments/BookingsPanel.js';
import AdminCalendar from '../admin/AdminCalendar.js';
import StaffSchedule from '../staff/StaffSchedule.js';
import './portal.css';

type Role = 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN';
type User = {id:string;name:string;email:string;role:Role};
type Service = {id:string;name:string;durationMinutes:number;priceCents:number;active:boolean};
type ProService = {id:string;name:string;active:boolean};
type Professional = {id:string;name:string;active:boolean;services:ProService[];hasAccount?:boolean};
type AuthMode = 'login' | 'register';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function price(cents:number){return money.format(cents/100)}

export default function Portal(){
  const [user,setUser]=useState<User|null>(null);
  const [authMode,setAuthMode]=useState<AuthMode>('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<{text:string;kind:'success'|'error'}|null>(null);
  const [services,setServices]=useState<Service[]>([]);
  const [professionals,setProfessionals]=useState<Professional[]>([]);
  const [adminServices,setAdminServices]=useState<Service[]>([]);
  const [adminPros,setAdminPros]=useState<Professional[]>([]);
  const [serviceEdit,setServiceEdit]=useState<string|null>(null);
  const [serviceName,setServiceName]=useState('');
  const [duration,setDuration]=useState('30');
  const [amount,setAmount]=useState('45.00');
  const [proEdit,setProEdit]=useState<string|null>(null);
  const [proName,setProName]=useState('');
  const [selectedServices,setSelectedServices]=useState<string[]>([]);
  const [bookingRevision,setBookingRevision]=useState(0);
  const updateBookings=()=>setBookingRevision(value=>value+1);

  async function refresh(role:Role|null){
    const [publicS,publicP]=await Promise.all([
      api<{services:Service[]}>('/services'),
      api<{professionals:Professional[]}>('/professionals'),
    ]);
    setServices(publicS.services);
    setProfessionals(publicP.professionals);
    if(role==='ADMIN'){
      const [allS,allP]=await Promise.all([
        api<{services:Service[]}>('/admin/services'),
        api<{professionals:Professional[]}>('/admin/professionals'),
      ]);
      setAdminServices(allS.services);
      setAdminPros(allP.professionals);
    } else {
      setAdminServices([]);
      setAdminPros([]);
    }
  }

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      let current:User|null=null;
      try{
        const result=await api<{user:User}>('/auth/me');
        current=result.user;
        if(active)setUser(current);
      }catch{/* Visitantes ainda não possuem sessão. */}
      try{
        if(active)await refresh(current?.role??null);
      }catch{
        if(active)setNotice({text:'API não conectada. Inicie o backend e o PostgreSQL para utilizar o catálogo.',kind:'error'});
      }
    };
    void load();
    return ()=>{active=false};
  },[]);

  async function submitAuth(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);setNotice(null);
    try{
      const payload=authMode==='register'?{name,email,password}:{email,password};
      const result=await api<{user:User}>(authMode==='register'?'/auth/register':'/auth/login',{
        method:'POST',body:JSON.stringify(payload),
      });
      setUser(result.user);setPassword('');
      await refresh(result.user.role);
      setNotice({text:`Bem-vindo, ${result.user.name}!`,kind:'success'});
    }catch(error){
      setNotice({text:(error as Error).message,kind:'error'});
    }finally{setBusy(false)}
  }

  async function logout(){
    setBusy(true);setNotice(null);
    try{
      await api('/auth/logout',{method:'POST'});
      setUser(null);setPassword('');setAdminServices([]);setAdminPros([]);
      await refresh(null);
      setNotice({text:'Sessão encerrada com sucesso.',kind:'success'});
    }catch(error){setNotice({text:(error as Error).message,kind:'error'})}
    finally{setBusy(false)}
  }

  async function saveService(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setNotice(null);
    try{
      const number=Number(amount.replace(',','.'));
      if(!Number.isFinite(number)||number<0)throw new Error('Informe um preço válido.');
      const data={name:serviceName,durationMinutes:Number(duration),priceCents:Math.round(number*100)};
      const path=serviceEdit?`/services/${serviceEdit}`:'/services';
      await api(path,{method:serviceEdit?'PATCH':'POST',body:JSON.stringify(data)});
      setServiceEdit(null);setServiceName('');setDuration('30');setAmount('45.00');
      await refresh('ADMIN');
      setNotice({text:'Serviço salvo com sucesso.',kind:'success'});
    }catch(error){setNotice({text:(error as Error).message,kind:'error'})}
    finally{setBusy(false)}
  }

  async function saveProfessional(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setNotice(null);
    try{
      const path=proEdit?`/professionals/${proEdit}`:'/professionals';
      await api(path,{method:proEdit?'PATCH':'POST',body:JSON.stringify({name:proName,serviceIds:selectedServices})});
      setProEdit(null);setProName('');setSelectedServices([]);
      await refresh('ADMIN');
      setNotice({text:'Profissional salvo com sucesso.',kind:'success'});
    }catch(error){setNotice({text:(error as Error).message,kind:'error'})}
    finally{setBusy(false)}
  }

  async function setActive(path:string,active:boolean){
    setBusy(true);setNotice(null);
    try{
      await api(path,{method:'PATCH',body:JSON.stringify({active})});
      await refresh('ADMIN');
      setNotice({text:'Status atualizado.',kind:'success'});
    }catch(error){setNotice({text:(error as Error).message,kind:'error'})}
    finally{setBusy(false)}
  }

  function editService(s:Service){
    setServiceEdit(s.id);setServiceName(s.name);
    setDuration(String(s.durationMinutes));setAmount((s.priceCents/100).toFixed(2));
  }
  function editProfessional(p:Professional){
    setProEdit(p.id);setProName(p.name);
    setSelectedServices(p.services.map(s=>s.id));
  }

  return <section className="portal-section" id="portal">
    <div className="section-wrap">
      <div className="section-heading">
        <div><span className="section-tag">/ FASE 01 · IMPLEMENTADO</span><h2>Contas e catálogo conectados.</h2></div>
        <p>Cadastro e login reais, serviços e profissionais em PostgreSQL. A seleção de horários e as reservas entram nas próximas etapas.</p>
      </div>
      {notice&&<div className={`portal-notice ${notice.kind}`} role="status">{notice.text}</div>}
      <div className="portal-grid">
        <div className="portal-panel">
          <div className="portal-panel-head"><span className="section-tag">SUA CONTA</span><span className="portal-asterisk">✳</span></div>
          {user ? <div className="portal-user">
            <div className="portal-avatar">{user.name.slice(0,1).toUpperCase()}</div>
            <h3>Olá, {user.name}!</h3>
            <p>{user.email}</p><span className="portal-role">{user.role==='ADMIN'?'Administrador':user.role==='PROFISSIONAL'?'Profissional':'Cliente'}</span>
            <button type="button" className="portal-secondary" disabled={busy} onClick={()=>void logout()}>Sair da conta</button>
            {user.role==='CLIENTE'&&<p className="portal-caption">Você já pode escolher um horário e confirmar seu atendimento na seção Agendamentos.</p>}
          </div>:<>
            <h3>Seu espaço começa aqui.</h3>
            <p className="portal-muted">Acesse sua conta ou cadastre-se para conhecer a plataforma.</p>
            <div className="portal-tabs" role="group" aria-label="Acesso à conta">
              <button type="button" className={authMode==='login'?'selected':''} onClick={()=>setAuthMode('login')}>Entrar</button>
              <button type="button" className={authMode==='register'?'selected':''} onClick={()=>setAuthMode('register')}>Criar conta</button>
            </div>
            <form onSubmit={e=>void submitAuth(e)} className="portal-form">
              {authMode==='register'&&<label>Nome completo<input autoComplete="name" required minLength={2} maxLength={140} value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome"/></label>}
              <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>
              <label>Senha<input type="password" autoComplete={authMode==='login'?'current-password':'new-password'} required minLength={authMode==='register'?12:1} value={password} onChange={e=>setPassword(e.target.value)} placeholder={authMode==='register'?'Mínimo de 12 caracteres':'Sua senha'}/></label>
              <button type="submit" className="portal-primary" disabled={busy}>{busy?'Processando...':authMode==='login'?'Entrar na conta':'Cadastrar cliente'} <span aria-hidden="true">↗</span></button>
            </form>
            <p className="portal-caption">Contas são armazenadas no PostgreSQL local. Não utilize senhas de serviços reais neste ambiente de estudo.</p>
          </>}
        </div>

        <div className="portal-panel portal-catalog">
          <div className="portal-panel-head"><span className="section-tag">CATÁLOGO ATIVO</span><span className="portal-count">{services.length} serviços</span></div>
          <h3>Escolha o que precisa.</h3>
          <p className="portal-muted">Valores e duração definidos pelos administradores.</p>
          <div className="portal-service-grid">
            {services.length===0?<div className="portal-empty">Nenhum serviço disponível. O catálogo será preenchido pelo administrador.</div>:services.map(s=>
              <article className="portal-service" key={s.id}>
                <div className="portal-service-top"><h4>{s.name}</h4><strong>{price(s.priceCents)}</strong></div>
                <span>{s.durationMinutes} minutos</span>
              </article>,
            )}
          </div>
          <div className="portal-subtitle">Profissionais disponíveis</div>
          <div className="portal-pros">
            {professionals.length===0?<p className="portal-muted">Nenhum profissional cadastrado.</p>:professionals.map(p=>
              <div key={p.id} className="portal-pro-card"><span className="portal-mini-avatar">{p.name[0]}</span>
                <div><strong>{p.name}</strong><small>{p.services.length?p.services.map(s=>s.name).join(' · '):'Serviços a definir'}</small></div></div>,
            )}
          </div>
        </div>
      </div>

      <AvailabilityPanel services={services} professionals={professionals}
        canBook={user?.role==='CLIENTE'} onBooked={updateBookings} refreshKey={bookingRevision}/>
      {user?.role==='CLIENTE'&&<BookingsPanel key={user.id} refreshKey={bookingRevision} onChanged={updateBookings}/>}
      {user?.role==='PROFISSIONAL'&&<StaffSchedule key={user.id}/>}

      {user?.role==='ADMIN'&&<div className="portal-admin">
        <div className="section-heading"><div><span className="section-tag">/ ADMINISTRAÇÃO</span><h2>Gestão do catálogo.</h2></div><p>Alterações são validadas na API. Registros podem ser desativados sem perder o histórico.</p></div>
        <div className="portal-grid">
          <div className="portal-panel">
            <h3>{serviceEdit?'Editar serviço':'Novo serviço'}</h3>
            <form className="portal-form" onSubmit={e=>void saveService(e)}>
              <label>Nome do serviço<input required minLength={2} maxLength={140} value={serviceName} onChange={e=>setServiceName(e.target.value)}/></label>
              <div className="portal-form-row">
                <label>Duração (minutos)<input required type="number" min={5} max={480} value={duration} onChange={e=>setDuration(e.target.value)}/></label>
                <label>Preço (R$)<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
              </div>
              <button className="portal-primary" disabled={busy} type="submit">{serviceEdit?'Salvar alterações':'Adicionar serviço'}</button>
              {serviceEdit&&<button type="button" className="portal-link-button" onClick={()=>{setServiceEdit(null);setServiceName('');setDuration('30');setAmount('45.00')}}>Cancelar edição</button>}
            </form>
            <div className="portal-admin-list">{adminServices.map(s=><div key={s.id} className="portal-admin-item">
              <div><strong>{s.name}</strong><small>{price(s.priceCents)} · {s.durationMinutes} min · {s.active?'Ativo':'Inativo'}</small></div>
              <div className="portal-admin-actions"><button type="button" disabled={busy} onClick={()=>editService(s)}>Editar</button><button type="button" disabled={busy} onClick={()=>void setActive(`/services/${s.id}`,!s.active)}>{s.active?'Desativar':'Ativar'}</button></div>
            </div>)}</div>
          </div>
          <div className="portal-panel">
            <h3>{proEdit?'Editar profissional':'Novo profissional'}</h3>
            <form className="portal-form" onSubmit={e=>void saveProfessional(e)}>
              <label>Nome do profissional<input required minLength={2} maxLength={140} value={proName} onChange={e=>setProName(e.target.value)}/></label>
              <div className="portal-field-label">Serviços que pode realizar</div>
              <div className="portal-checks">{adminServices.filter(s=>s.active).map(s=><label key={s.id}><input type="checkbox" checked={selectedServices.includes(s.id)} onChange={e=>setSelectedServices(current=>e.target.checked?[...current,s.id]:current.filter(id=>id!==s.id))}/>{s.name}</label>)}</div>
              <button className="portal-primary" disabled={busy} type="submit">{proEdit?'Salvar alterações':'Adicionar profissional'}</button>
              {proEdit&&<button type="button" className="portal-link-button" onClick={()=>{setProEdit(null);setProName('');setSelectedServices([])}}>Cancelar edição</button>}
            </form>
            <div className="portal-admin-list">{adminPros.map(p=><div key={p.id} className="portal-admin-item">
              <div><strong>{p.name}</strong><small>{p.active?'Ativo':'Inativo'} · {p.services.map(s=>s.name).join(', ')||'Sem serviços'} · {p.hasAccount?'Conta vinculada':'Sem acesso profissional'}</small>
                <small>ID para provisionar conta: <code>{p.id}</code></small></div>
              <div className="portal-admin-actions"><button type="button" disabled={busy} onClick={()=>editProfessional(p)}>Editar</button><button type="button" disabled={busy} onClick={()=>void setActive(`/professionals/${p.id}`,!p.active)}>{p.active?'Desativar':'Ativar'}</button></div>
            </div>)}</div>
          </div>
        </div>
        <AvailabilityAdmin professionals={adminPros}/>
        <AdminCalendar services={adminServices} professionals={adminPros} onChanged={updateBookings}/>
      </div>}
    </div>
  </section>;
}
