import {useEffect,useState} from 'react';
import {api} from '../../lib/api.js';
import './appointments.css';

type Booking={
  id:string;professionalId:string;serviceId:string;
  startsAt:string;endsAt:string;status:'PENDENTE'|'CONFIRMADO'|'CONCLUIDO'|'CANCELADO';
  priceCents:number;serviceName:string;professionalName:string;
};
type ListResponse={appointments:Booking[];timezone:string};
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export default function BookingsPanel({refreshKey,onChanged}:{
  refreshKey:number;onChanged:()=>void;
}){
  const [data,setData]=useState<Booking[]>([]);
  const [timezone,setTimezone]=useState('America/Sao_Paulo');
  const [loading,setLoading]=useState(true);
  const [canceling,setCanceling]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    let active=true;
    setLoading(true);
    api<ListResponse>('/appointments/mine')
      .then(v=>{if(active){setData(v.appointments);setTimezone(v.timezone);setError('')}})
      .catch(err=>{if(active)setError((err as Error).message)})
      .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[refreshKey]);

  function when(value:string){
    return new Date(value).toLocaleString('pt-BR',{
      timeZone:timezone,dateStyle:'medium',timeStyle:'short',
    });
  }
  async function cancel(booking:Booking){
    if(!window.confirm(`Cancelar o atendimento de ${booking.serviceName} em ${when(booking.startsAt)}?`))return;
    setCanceling(booking.id);setError('');setNotice('');
    try{
      await api(`/appointments/${booking.id}/cancel`,{method:'PATCH'});
      setNotice('Agendamento cancelado. O horário foi liberado para outras pessoas.');
      onChanged();
    }catch(err){setError((err as Error).message)}
    finally{setCanceling(null)}
  }

  return <section className="af-bookings" id="minhas-reservas" aria-labelledby="af-bookings-title">
    <div className="af-bookings-head">
      <div><span className="section-tag">/ MEUS AGENDAMENTOS</span>
        <h3 id="af-bookings-title">Sua agenda, em um só lugar.</h3>
      </div>
      <p>Consulte seus atendimentos e cancele os futuros quando necessário.</p>
    </div>
    {error&&<p className="af-bookings-error" role="alert">{error}</p>}
    {notice&&<p className="af-bookings-ok" role="status">{notice}</p>}
    {loading?<p className="af-bookings-muted">Carregando agendamentos...</p>
      :data.length===0?<p className="af-bookings-empty">Você ainda não tem agendamentos. Consulte um horário disponível acima para começar.</p>
      :<div className="af-bookings-list">{data.map(booking=>{
        const canCancel=['PENDENTE','CONFIRMADO'].includes(booking.status)&&
          Date.parse(booking.startsAt)>Date.now();
        return <article className="af-booking-card" key={booking.id}>
          <div className="af-booking-date"><span>{when(booking.startsAt)}</span>
            <small>{booking.status==='CONFIRMADO'?'Confirmado':booking.status==='CANCELADO'?'Cancelado':
              booking.status==='PENDENTE'?'Pendente':'Concluído'}</small></div>
          <div className="af-booking-info"><h4>{booking.serviceName}</h4>
            <p>{booking.professionalName} · {money.format(booking.priceCents/100)}</p>
            <small>Término previsto: {when(booking.endsAt)}</small>
          </div>
          {canCancel&&<button type="button" disabled={canceling!==null}
            onClick={()=>void cancel(booking)}>{canceling===booking.id?'Cancelando...':'Cancelar'}</button>}
        </article>;
      })}</div>}
    <p className="af-bookings-muted">Exibindo os 50 agendamentos mais recentes. Horários exibidos no fuso {timezone}.</p>
  </section>;
}
