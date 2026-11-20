import {useEffect,useState,type FormEvent} from 'react';
import {api} from '../../lib/api.js';
import type {Professional,Service,SlotsResult} from '../availability/types.js';
import './admin-calendar.css';

type Status='PENDENTE'|'CONFIRMADO'|'CONCLUIDO'|'CANCELADO';
type AdminAppointment={
  id:string;professionalId:string;serviceId:string;clientId:string;
  startsAt:string;endsAt:string;status:Status;priceCents:number;
  serviceName:string;professionalName:string;clientName:string;clientEmail:string;
};
type CalendarResult={
  timezone:string;from:string;to:string;offset:number;pageSize:number;total:number;
  counts:Array<{status:Status;count:number}>;
  appointments:AdminAppointment[];
};
type Client={id:string;name:string;email:string};

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const statusNames:Record<Status,string>={
  PENDENTE:'Pendente',CONFIRMADO:'Confirmado',CONCLUIDO:'Concluído',CANCELADO:'Cancelado',
};
function businessISO(date:Date,zone='America/Sao_Paulo'){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function dayAfter(date:string,days:number){
  return new Date(Date.parse(date+'T12:00:00Z')+days*86_400_000).toISOString().slice(0,10);
}
function displayDate(iso:string,zone:string){
  return new Date(iso).toLocaleString('pt-BR',{timeZone:zone,dateStyle:'medium',timeStyle:'short'});
}
function listDates(from:string,to:string){
  const values:string[]=[];
  for(let day=from;day<=to&&values.length<31;day=dayAfter(day,1))values.push(day);
  return values;
}
const initialDay=businessISO(new Date());

export default function AdminCalendar({services,professionals,onChanged}:{
  services:Service[];professionals:Professional[];onChanged:()=>void;
}){
  const [from,setFrom]=useState(initialDay);
  const [to,setTo]=useState(dayAfter(initialDay,6));
  const [professionalId,setProfessionalId]=useState('');
  const [status,setStatus]=useState<''|Status>('');
  const [data,setData]=useState<CalendarResult|null>(null);
  const [offset,setOffset]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const [search,setSearch]=useState('');
  const [clients,setClients]=useState<Client[]>([]);
  const [selectedClient,setSelectedClient]=useState<Client|null>(null);
  const [manualService,setManualService]=useState('');
  const [manualProfessional,setManualProfessional]=useState('');
  const [manualDate,setManualDate]=useState(initialDay);
  const [slots,setSlots]=useState<SlotsResult|null>(null);
  const [selectedStart,setSelectedStart]=useState('');
  const [searchingSlots,setSearchingSlots]=useState(false);

  const availableServices=services.filter(s=>s.active);
  const enabledProfessionals=professionals.filter(p=>p.active);
  const qualified=enabledProfessionals.filter(p=>p.services.some(s=>s.id===manualService&&s.active));

  async function load(nextOffset=0,nextFrom=from,nextTo=to){
    const params=new URLSearchParams({from:nextFrom,to:nextTo,offset:String(nextOffset)});
    if(professionalId)params.set('professionalId',professionalId);
    if(status)params.set('status',status);
    const result=await api<CalendarResult>(`/admin/appointments?${params}`);
    setData(result);setOffset(nextOffset);
  }
  useEffect(()=>{
    let active=true;
    const parameters=new URLSearchParams({from:initialDay,to:dayAfter(initialDay,6)});
    api<CalendarResult>(`/admin/appointments?${parameters}`)
      .then(value=>{if(active){setData(value);setError('')}})
      .catch(e=>{if(active)setError((e as Error).message)});
    return()=>{active=false};
  },[]);

  async function applyFilter(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{await load(0)}catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function changePage(next:number){
    setBusy(true);setError('');
    try{await load(next)}catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function changeStatus(appointment:AdminAppointment,target:Status){
    setBusy(true);setError('');setNotice('');
    try{
      await api(`/admin/appointments/${appointment.id}/status`,{
        method:'PATCH',body:JSON.stringify({status:target}),
      });
      await load(offset);
      onChanged();
      setNotice(`Status de ${appointment.clientName} atualizado para ${statusNames[target]}.`);
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function searchClients(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try{
      const result=await api<{clients:Client[]}>(`/admin/clients?query=${encodeURIComponent(search.trim())}`);
      setClients(result.clients);setSelectedClient(null);
      if(!result.clients.length)setError('Nenhum cliente encontrado. O cadastro é realizado pelo próprio cliente.');
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }
  async function loadSlots(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSearchingSlots(true);setError('');setSlots(null);setSelectedStart('');
    try{
      const params=new URLSearchParams({
        serviceId:manualService,professionalId:manualProfessional,date:manualDate,
      });
      const result=await api<SlotsResult>(`/availability/slots?${params}`);
      setSlots(result);
    }catch(e){setError((e as Error).message)}
    finally{setSearchingSlots(false)}
  }
  async function createManual(){
    if(!selectedClient||!selectedStart)return;
    setBusy(true);setError('');setNotice('');
    try{
      await api('/admin/appointments',{method:'POST',body:JSON.stringify({
        clientId:selectedClient.id,serviceId:manualService,
        professionalId:manualProfessional,startsAt:selectedStart,
      })});
      setNotice(`Agendamento de ${selectedClient.name} criado com sucesso.`);
      setSlots(null);setSelectedStart('');
      await load(0);
      onChanged();
    }catch(e){
      setError((e as Error).message);
      setSelectedStart('');
      setSlots(null);
    }finally{setBusy(false)}
  }

  const days=data?listDates(data.from,data.to):[];
  const countForDay=(day:string)=>data?.appointments.filter(item=>businessISO(new Date(item.startsAt),data.timezone)===day).length??0;
  const statuses=data?.counts??[];

  return <section className="admin-calendar" id="admin-calendario">
    <div className="af-availability-head">
      <div><span className="section-tag">/ FASE 04 · OPERAÇÃO ADMINISTRATIVA</span>
        <h3>Calendário de atendimentos.</h3></div>
      <p>Visualize reservas reais, acompanhe os profissionais e altere estados com rastreabilidade.</p>
    </div>
    {error&&<p className="admin-feedback error" role="alert">{error}</p>}
    {notice&&<p className="admin-feedback success" role="status">{notice}</p>}
    <form className="admin-calendar-filters" onSubmit={e=>void applyFilter(e)}>
      <label>De<input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>Até<input type="date" required value={to} min={from} onChange={e=>setTo(e.target.value)}/></label>
      <label>Profissional<select value={professionalId} onChange={e=>setProfessionalId(e.target.value)}>
        <option value="">Todos</option>{professionals.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
      </select></label>
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value as ''|Status)}>
        <option value="">Todos</option>{Object.entries(statusNames).map(([key,value])=><option key={key} value={key}>{value}</option>)}
      </select></label>
      <button type="submit" disabled={busy}>Aplicar filtros</button>
    </form>
    {data&&<>
      <div className="admin-summary">
        <div><span>Agendamentos</span><strong>{data.total}</strong></div>
        {statuses.map(item=><div key={item.status}><span>{statusNames[item.status]}</span><strong>{item.count}</strong></div>)}
      </div>
      <div className="admin-days" aria-label="Dias do período">
        {days.map(day=><button key={day} type="button"
          onClick={()=>{setFrom(day);setTo(day);setNotice('Selecione Aplicar filtros para abrir o dia escolhido.')}}
          className={from===day&&to===day?'selected':''}>
          <span>{new Date(day+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'})}</span>
          <strong>{day.slice(8)}</strong>
          <small>{countForDay(day)} visíveis</small>
        </button>)}
      </div>
      <div className="admin-list-head">
        <h4>Atendimentos do período</h4>
        <span>{data.total? `${offset+1}–${Math.min(offset+data.appointments.length,data.total)} de ${data.total}`:'Nenhum resultado'}</span>
      </div>
      <div className="admin-appointments-list">
        {!data.appointments.length&&<p className="af-bookings-empty">Nenhum agendamento corresponde aos filtros selecionados.</p>}
        {data.appointments.map(item=>{
          const future=Date.parse(item.startsAt)>Date.now();
          const ended=Date.parse(item.endsAt)<=Date.now();
          const canConfirm=item.status==='PENDENTE'&&future;
          const canCancel=['PENDENTE','CONFIRMADO'].includes(item.status)&&future;
          const canComplete=item.status==='CONFIRMADO'&&ended;
          return <article className="admin-appointment-row" key={item.id}>
            <div className="admin-appointment-time">
              <strong>{displayDate(item.startsAt,data.timezone)}</strong>
              <small>até {new Date(item.endsAt).toLocaleTimeString('pt-BR',{timeZone:data.timezone,hour:'2-digit',minute:'2-digit'})}</small>
            </div>
            <div className="admin-appointment-info">
              <h5>{item.serviceName} <span className={`admin-status status-${item.status.toLowerCase()}`}>{statusNames[item.status]}</span></h5>
              <p>{item.professionalName} · {money.format(item.priceCents/100)}</p>
              <small>Cliente: {item.clientName} · {item.clientEmail}</small>
            </div>
            <div className="admin-appointment-actions">
              {canConfirm&&<button type="button" disabled={busy}
                onClick={()=>void changeStatus(item,'CONFIRMADO')}>Confirmar</button>}
              {canComplete&&<button type="button" disabled={busy}
                onClick={()=>void changeStatus(item,'CONCLUIDO')}>Concluir</button>}
              {canCancel&&<button type="button" className="danger" disabled={busy}
                onClick={()=>{if(window.confirm('Cancelar o agendamento de '+item.clientName+'?'))void changeStatus(item,'CANCELADO')}}>Cancelar</button>}
            </div>
          </article>;
        })}
      </div>
      {data.total>data.pageSize&&<div className="admin-pagination">
        <button type="button" disabled={busy||offset===0} onClick={()=>void changePage(Math.max(0,offset-100))}>Anterior</button>
        <button type="button" disabled={busy||offset+100>=data.total} onClick={()=>void changePage(offset+100)}>Próxima página</button>
      </div>}
      <p className="admin-technical-note">Período máximo: 31 dias. Horários exibidos em {data.timezone}. Contagens por dia refletem apenas a página carregada.</p>
    </>}

    <div className="admin-manual-booking">
      <div className="af-availability-head">
        <div><span className="section-tag">/ RESERVA MANUAL</span><h3>Agendar para um cliente.</h3></div>
        <p>Selecione uma conta existente. As mesmas regras de horários e conflito usadas pelos clientes são aplicadas aqui.</p>
      </div>
      <form className="admin-client-search" onSubmit={e=>void searchClients(e)}>
        <label>Pesquisar por nome ou e-mail<input value={search} minLength={3} required
          onChange={e=>{setSearch(e.target.value);setClients([]);setSelectedClient(null)}}
          placeholder="Digite ao menos 3 caracteres"/></label>
        <button type="submit" disabled={busy}>Buscar cliente</button>
      </form>
      {clients.length>0&&<div className="admin-client-results" role="group" aria-label="Clientes encontrados">
        {clients.map(client=><button key={client.id} type="button"
          className={selectedClient?.id===client.id?'selected':''}
          onClick={()=>setSelectedClient(client)}>
          <strong>{client.name}</strong><small>{client.email}</small>
        </button>)}
      </div>}
      <form className="admin-manual-form" onSubmit={e=>void loadSlots(e)}>
        <label>Serviço<select required value={manualService}
          onChange={e=>{setManualService(e.target.value);setManualProfessional('');setSlots(null)}}>
          <option value="">Selecione</option>{availableServices.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
        </select></label>
        <label>Profissional<select required value={manualProfessional} disabled={!manualService}
          onChange={e=>{setManualProfessional(e.target.value);setSlots(null)}}>
          <option value="">Selecione</option>{qualified.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
        <label>Data<input type="date" value={manualDate} min={businessISO(new Date())}
          onChange={e=>{setManualDate(e.target.value);setSlots(null)}} required/></label>
        <button disabled={searchingSlots||!manualService||!manualProfessional} type="submit">
          {searchingSlots?'Consultando...':'Consultar horários'}</button>
      </form>
      {slots&&<div className="admin-manual-slots">
        <p>{slots.slots.length} horários livres no dia escolhido</p>
        <div className="admin-slot-grid">{slots.slots.map(slot=><button type="button"
          key={slot.startsAt} className={selectedStart===slot.startsAt?'selected':''}
          onClick={()=>setSelectedStart(slot.startsAt)}>{slot.label}</button>)}</div>
        {selectedStart&&<div className="admin-final-confirmation">
          <span>{selectedClient?.name??'Selecione um cliente'} · {slots.slots.find(s=>s.startsAt===selectedStart)?.label}</span>
          <button type="button" disabled={busy||!selectedClient} onClick={()=>void createManual()}>
            {busy?'Salvando...':'Confirmar reserva manual'}
          </button>
        </div>}
      </div>}
    </div>
  </section>;
}
