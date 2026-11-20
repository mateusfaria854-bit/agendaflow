import {useEffect,useState,type FormEvent} from 'react';
import {api} from '../../lib/api.js';
import type {Professional,Service,SlotsResult} from './types.js';
import './availability.css';

function businessToday(){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(new Date());
}

export default function AvailabilityPanel({services,professionals,canBook,onBooked,refreshKey}:{
  services:Service[];
  professionals:Professional[];
  canBook:boolean;
  onBooked:()=>void;
  refreshKey:number;
}){
  const [serviceId,setServiceId]=useState('');
  const [professionalId,setProfessionalId]=useState('');
  const [date,setDate]=useState(businessToday);
  const [loading,setLoading]=useState(false);
  const [booking,setBooking]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [result,setResult]=useState<SlotsResult|null>(null);
  const qualified=professionals.filter(p=>p.services.some(s=>s.id===serviceId&&s.active));

  async function loadSlots(){
    const params=new URLSearchParams({serviceId,professionalId,date});
    const data=await api<SlotsResult>(`/availability/slots?${params.toString()}`);
    setResult(data);
    setSelected(null);
  }

  async function search(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setNotice('');setLoading(true);setResult(null);setSelected(null);
    try{await loadSlots()}
    catch(err){setError((err as Error).message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{
    // Uma reserva nova ou cancelamento atualiza a consulta exibida.
    if(refreshKey===0 || !result || !serviceId || !professionalId)return;
    let active=true;
    const params=new URLSearchParams({serviceId,professionalId,date});
    api<SlotsResult>(`/availability/slots?${params.toString()}`)
      .then(data=>{if(active){setResult(data);setSelected(null)}})
      .catch(err=>{if(active)setError((err as Error).message)});
    return()=>{active=false};
  },[refreshKey]);

  async function confirmBooking(){
    if(!selected || !canBook || booking)return;
    setBooking(true);setError('');setNotice('');
    try{
      await api('/appointments',{method:'POST',body:JSON.stringify({
        professionalId,serviceId,startsAt:selected,
      })});
      setNotice('Agendamento confirmado! Confira a seção Meus agendamentos.');
      onBooked();
    }catch(err){
      setError((err as Error).message);
      try{await loadSlots()}catch{/* A mensagem original é preservada. */}
    }finally{setBooking(false)}
  }

  return <div className="af-availability" id="horarios">
    <div className="af-availability-head">
      <div><span className="section-tag">/ FASE 03 · AGENDAMENTOS</span>
        <h3>Encontre seu próximo horário.</h3>
      </div>
      <p>Escolha serviço, profissional e data. Um horário é confirmado somente depois da validação no servidor.</p>
    </div>
    <form className="af-availability-form" onSubmit={e=>void search(e)}>
      <label>Serviço
        <select value={serviceId} required onChange={e=>{setServiceId(e.target.value);setProfessionalId('');setResult(null);setSelected(null)}}>
          <option value="">Selecione</option>
          {services.map(s=><option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min</option>)}
        </select>
      </label>
      <label>Profissional
        <select value={professionalId} required disabled={!serviceId}
          onChange={e=>{setProfessionalId(e.target.value);setResult(null);setSelected(null)}}>
          <option value="">Selecione</option>
          {qualified.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>Data
        <input type="date" required min={businessToday()} value={date}
          onChange={e=>{setDate(e.target.value);setResult(null);setSelected(null)}}/>
      </label>
      <button type="submit" disabled={loading||booking||!serviceId||!professionalId}>
        {loading?'Consultando...':'Consultar horários'}
      </button>
    </form>
    {error&&<p className="af-error" role="alert">{error}</p>}
    {notice&&<p className="af-booking-notice" role="status">{notice}</p>}
    {result&&<div className="af-slot-results" aria-live="polite">
      <div className="af-slot-head">
        <strong>{result.slots.length} horários disponíveis</strong>
        <span>{result.date} · {result.timezone}</span>
      </div>
      {result.slots.length
        ? <div className="af-slots">{result.slots.map(s=>canBook
          ? <button type="button" className={`af-slot af-booking-slot${selected===s.startsAt?' af-booking-slot-selected':''}`}
              aria-pressed={selected===s.startsAt}
              onClick={()=>{setSelected(s.startsAt);setNotice('')}} disabled={booking}
              key={s.startsAt}>{s.label}<small>{s.offset}</small></button>
          : <span className="af-slot" key={s.startsAt}>{s.label}<small>{s.offset}</small></span>,
        )}</div>
        : <p className="af-empty-slots">Nenhum horário livre nesta data. Selecione outro dia.</p>}
      {canBook&&selected&&<div className="af-booking-confirm">
        <p>Você selecionou <strong>{result.slots.find(s=>s.startsAt===selected)?.label}</strong>.
          Preço: <strong>{new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(
            (services.find(s=>s.id===serviceId)?.priceCents??0)/100,
          )}</strong>. O valor será conferido no servidor.</p>
        <button type="button" disabled={booking} onClick={()=>void confirmBooking()}>
          {booking?'Confirmando...':'Confirmar agendamento'}
        </button>
      </div>}
      {!canBook&&<p className="af-help">Entre ou cadastre-se como cliente para confirmar um horário.</p>}
      {canBook&&<p className="af-help">Disponibilidade pode mudar até a confirmação. O servidor impede reservas duplicadas.</p>}
    </div>}
  </div>;
}
