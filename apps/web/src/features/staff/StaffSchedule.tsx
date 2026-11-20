import {useEffect,useState,type FormEvent} from 'react';
import {api} from '../../lib/api.js';
import './staff-schedule.css';

type Status='PENDENTE'|'CONFIRMADO'|'CONCLUIDO'|'CANCELADO';
type Appointment={
  id:string;startsAt:string;endsAt:string;status:Status;
  serviceName:string;clientName:string;
};
type Agenda={
  professional:{id:string;name:string};
  timezone:string;from:string;to:string;offset:number;pageSize:number;total:number;
  appointments:Appointment[];
};
const statusNames:Record<Status,string>={
  PENDENTE:'Pendente',CONFIRMADO:'Confirmado',CONCLUIDO:'Concluído',CANCELADO:'Cancelado',
};
function businessDay(date:Date){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(date).map(x=>[x.type,x.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
}
function shiftDay(date:string,amount:number){
  return new Date(Date.parse(date+'T12:00:00Z')+amount*86_400_000).toISOString().slice(0,10);
}
const initial=businessDay(new Date());

export default function StaffSchedule(){
  const [from,setFrom]=useState(initial);
  const [to,setTo]=useState(shiftDay(initial,6));
  const [status,setStatus]=useState<Status|''>('');
  const [agenda,setAgenda]=useState<Agenda|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  async function load(offset:number,range:{from:string;to:string;status:string}){
    const params=new URLSearchParams({from:range.from,to:range.to,offset:String(offset)});
    if(range.status)params.set('status',range.status);
    const response=await api<Agenda>('/staff/appointments?'+params.toString());
    setAgenda(response);
    setError('');
  }
  useEffect(()=>{
    let active=true;
    const params=new URLSearchParams({from:initial,to:shiftDay(initial,6)});
    api<Agenda>('/staff/appointments?'+params.toString())
      .then(data=>{if(active)setAgenda(data)})
      .catch(e=>{if(active)setError((e as Error).message)});
    return()=>{active=false};
  },[]);

  async function filter(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setError('');
    try{await load(0,{from,to,status})}catch(e){setError((e as Error).message)}
    finally{setLoading(false)}
  }
  async function page(offset:number){
    setLoading(true);
    try{await load(offset,{from:agenda?.from??from,to:agenda?.to??to,status})}
    catch(e){setError((e as Error).message)}
    finally{setLoading(false)}
  }
  const when=(time:string,zone:string)=>new Date(time).toLocaleString('pt-BR',{
    dateStyle:'medium',timeStyle:'short',timeZone:zone,
  });

  return <section className="staff-schedule" aria-labelledby="staff-heading" id="minha-agenda-profissional">
    <div className="staff-heading">
      <div><span className="section-tag">/ AGENDA PROFISSIONAL</span>
        <h3 id="staff-heading">Seus atendimentos, com privacidade.</h3></div>
      <p>Visualização somente da sua agenda. A administração das reservas continua restrita aos administradores.</p>
    </div>
    <form onSubmit={e=>void filter(e)} className="staff-filters">
      <label>De<input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>Até<input type="date" min={from} required value={to} onChange={e=>setTo(e.target.value)}/></label>
      <label>Status<select value={status} onChange={e=>setStatus(e.target.value as Status|'')}>
        <option value="">Todos</option>
        {Object.entries(statusNames).map(([code,label])=><option value={code} key={code}>{label}</option>)}
      </select></label>
      <button disabled={loading} type="submit">{loading?'Consultando...':'Aplicar filtros'}</button>
    </form>
    {error&&<p className="staff-error" role="alert">{error}</p>}
    {agenda&&<>
      <div className="staff-meta">
        <strong>{agenda.professional.name}</strong>
        <span>{agenda.total} atendimento(s) · Fuso: {agenda.timezone}</span>
      </div>
      <div className="staff-list" aria-live="polite">
        {!agenda.appointments.length&&<p className="staff-empty">Nenhum atendimento encontrado para o período selecionado.</p>}
        {agenda.appointments.map(item=><article key={item.id} className="staff-appointment">
          <div className="staff-appointment-date">
            <strong>{when(item.startsAt,agenda.timezone)}</strong>
            <small>até {new Date(item.endsAt).toLocaleTimeString('pt-BR',{
              hour:'2-digit',minute:'2-digit',timeZone:agenda.timezone,
            })}</small>
          </div>
          <div><h4>{item.serviceName}</h4>
            <p>Cliente: {item.clientName}</p>
          </div>
          <span className={'staff-status staff-status-'+item.status.toLowerCase()}>{statusNames[item.status]}</span>
        </article>)}
      </div>
      {agenda.total>agenda.pageSize&&<div className="staff-pagination">
        <button type="button" disabled={loading||agenda.offset===0}
          onClick={()=>void page(Math.max(0,agenda.offset-100))}>Anterior</button>
        <button type="button" disabled={loading||agenda.offset+100>=agenda.total}
          onClick={()=>void page(agenda.offset+100)}>Próxima página</button>
      </div>}
      <p className="staff-caption">Exibição de até 100 atendimentos por página e períodos de até 31 dias. Nenhum dado financeiro ou e-mail de cliente é disponibilizado nesta área.</p>
    </>}
  </section>;
}
