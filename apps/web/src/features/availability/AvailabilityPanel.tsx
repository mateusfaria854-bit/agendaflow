import {useState, type FormEvent} from 'react';
import {api} from '../../lib/api.js';
import type {Professional,Service,SlotsResult} from './types.js';
import './availability.css';

function businessToday(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}

export default function AvailabilityPanel({services,professionals}:{
  services:Service[];professionals:Professional[];
}){
  const [serviceId,setServiceId]=useState('');
  const [professionalId,setProfessionalId]=useState('');
  const [date,setDate]=useState(businessToday);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState<SlotsResult|null>(null);
  const qualified=professionals.filter(p=>p.services.some(s=>s.id===serviceId&&s.active));

  async function search(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setLoading(true);setResult(null);
    try{
      const params=new URLSearchParams({serviceId,professionalId,date});
      const response=await api<SlotsResult>(`/availability/slots?${params.toString()}`);
      setResult(response);
    }catch(err){setError((err as Error).message)}
    finally{setLoading(false)}
  }

  return <div className="af-availability" id="horarios">
    <div className="af-availability-head">
      <div><span className="section-tag">/ FASE 02 · DISPONIBILIDADE</span><h3>Encontre seu próximo horário.</h3></div>
      <p>Horários calculados pela API a partir do expediente, duração, pausas e bloqueios. Agendar será possível na Fase 3.</p>
    </div>
    <form className="af-availability-form" onSubmit={e=>void search(e)}>
      <label>Serviço
        <select value={serviceId} required onChange={e=>{setServiceId(e.target.value);setProfessionalId('');setResult(null)}}>
          <option value="">Selecione</option>
          {services.map(s=><option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min</option>)}
        </select>
      </label>
      <label>Profissional
        <select value={professionalId} required disabled={!serviceId} onChange={e=>{setProfessionalId(e.target.value);setResult(null)}}>
          <option value="">Selecione</option>
          {qualified.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>Data
        <input type="date" required min={businessToday()} value={date} onChange={e=>{setDate(e.target.value);setResult(null)}}/>
      </label>
      <button type="submit" disabled={loading||!serviceId||!professionalId}>{loading?'Consultando...':'Consultar horários'}</button>
    </form>
    {error&&<p className="af-error" role="alert">{error}</p>}
    {result&&<div className="af-slot-results" aria-live="polite">
      <div className="af-slot-head"><strong>{result.slots.length} horários disponíveis</strong><span>{result.date} · {result.timezone}</span></div>
      {result.slots.length
        ? <div className="af-slots">{result.slots.map(s=><span className="af-slot" key={s.startsAt}>{s.label}<small>{s.offset}</small></span>)}</div>
        : <p className="af-empty-slots">Nenhum horário livre nesta data. Selecione outro dia.</p>}
      <p className="af-help">Consulta informativa. Nenhuma reserva é criada nesta etapa.</p>
    </div>}
  </div>;
}
