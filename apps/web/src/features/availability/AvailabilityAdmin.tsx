import {useEffect,useState,type FormEvent} from 'react';
import {api} from '../../lib/api.js';
import type {BlockedPeriod,Professional,WeeklyWindow} from './types.js';
import {WEEKDAYS} from './types.js';

type SettingsResponse={professionalId:string;timezone:string;windows:Array<WeeklyWindow & {id:string}>;blocked:BlockedPeriod[]};

function toUTC(local:string){
  const stamp=new Date(local).getTime();
  if(!Number.isFinite(stamp))throw new Error('Informe datas de início e fim válidas.');
  return new Date(stamp).toISOString();
}
function dateLabel(value:string,zone:string){
  return new Date(value).toLocaleString('pt-BR',{timeZone:zone,dateStyle:'short',timeStyle:'short'});
}

export default function AvailabilityAdmin({professionals}:{
  professionals:Professional[];
}){
  const [professionalId,setProfessionalId]=useState('');
  const [timezone,setTimezone]=useState('America/Sao_Paulo');
  const [windows,setWindows]=useState<WeeklyWindow[]>([]);
  const [blocked,setBlocked]=useState<BlockedPeriod[]>([]);
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [reason,setReason]=useState('');
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');

  async function reload(id:string){
    const data=await api<SettingsResponse>(`/admin/availability?professionalId=${encodeURIComponent(id)}`);
    setWindows(data.windows.map(({weekday,startTime,endTime})=>({weekday,startTime,endTime})));
    setBlocked(data.blocked);setTimezone(data.timezone);
  }

  useEffect(()=>{
    if(!professionalId){setWindows([]);setBlocked([]);return}
    let active=true;
    api<SettingsResponse>(`/admin/availability?professionalId=${encodeURIComponent(professionalId)}`)
      .then(data=>{if(active){setWindows(data.windows.map(({weekday,startTime,endTime})=>({weekday,startTime,endTime})));setBlocked(data.blocked);setTimezone(data.timezone)}})
      .catch(e=>{if(active)setError((e as Error).message)});
    return()=>{active=false};
  },[professionalId]);

  function update(index:number,patch:Partial<WeeklyWindow>){
    setWindows(current=>current.map((w,i)=>i===index?{...w,...patch}:w));
  }

  async function saveSchedule(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setError('');setNotice('');
    try{
      await api(`/admin/professionals/${professionalId}/availability`,{
        method:'PUT',body:JSON.stringify({windows}),
      });
      await reload(professionalId);
      setNotice('Expediente semanal atualizado.');
    }catch(e){setError((e as Error).message)}
    finally{setLoading(false)}
  }

  async function addBlock(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setError('');setNotice('');
    try{
      await api('/admin/blocked-periods',{
        method:'POST',body:JSON.stringify({
          professionalId,startsAt:toUTC(start),endsAt:toUTC(end),reason,
        }),
      });
      setStart('');setEnd('');setReason('');
      await reload(professionalId);
      setNotice('Bloqueio registrado.');
    }catch(e){setError((e as Error).message)}
    finally{setLoading(false)}
  }

  async function removeBlock(id:string){
    setLoading(true);setError('');setNotice('');
    try{
      await api(`/admin/blocked-periods/${id}`,{method:'DELETE'});
      await reload(professionalId);
      setNotice('Bloqueio removido.');
    }catch(e){setError((e as Error).message)}
    finally{setLoading(false)}
  }

  return <div className="af-admin-availability">
    <div className="af-availability-head">
      <div><span className="section-tag">/ GESTÃO DE HORÁRIOS</span><h3>Expediente e bloqueios.</h3></div>
      <p>Defina turnos por dia e bloqueie períodos de folga. As mudanças são salvas no PostgreSQL.</p>
    </div>
    <label className="af-prof-select">Profissional
      <select value={professionalId} onChange={e=>{setProfessionalId(e.target.value);setError('');setNotice('')}}>
        <option value="">Selecione um profissional</option>
        {professionals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    {error&&<p className="af-error" role="alert">{error}</p>}
    {notice&&<p className="af-ok" role="status">{notice}</p>}
    {professionalId&&<div className="af-admin-availability-grid">
      <form className="af-config-card" onSubmit={e=>void saveSchedule(e)}>
        <h4>Jornada semanal</h4>
        <p>Adicione um turno separado para cada período, inclusive antes e depois do almoço.</p>
        <div className="af-window-list">
          {windows.map((window,index)=><div className="af-window" key={index}>
            <select value={window.weekday} aria-label="Dia da semana" onChange={e=>update(index,{weekday:Number(e.target.value)})}>
              {WEEKDAYS.map((label,i)=><option value={i} key={i}>{label}</option>)}
            </select>
            <input type="time" required aria-label="Início do turno" value={window.startTime} onChange={e=>update(index,{startTime:e.target.value})}/>
            <input type="time" required aria-label="Fim do turno" value={window.endTime} onChange={e=>update(index,{endTime:e.target.value})}/>
            <button type="button" className="af-remove" aria-label="Remover período" onClick={()=>setWindows(current=>current.filter((_,i)=>i!==index))}>×</button>
          </div>)}
          {!windows.length&&<p className="af-helper">Sem períodos definidos. Adicione um turno para disponibilizar horários.</p>}
        </div>
        <div className="af-form-actions">
          <button type="button" className="af-outline" onClick={()=>setWindows(current=>[...current,{weekday:1,startTime:'09:00',endTime:'12:00'}])}>+ Adicionar período</button>
          <button type="submit" disabled={loading}>Salvar expediente</button>
        </div>
      </form>
      <div className="af-config-card">
        <h4>Folgas e pausas excepcionais</h4>
        <p>Bloqueios especiais são informados no horário do seu dispositivo. O calendário da empresa usa {timezone}.</p>
        <form onSubmit={e=>void addBlock(e)} className="af-block-form">
          <label>Início<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label>
          <label>Fim<input type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label>
          <label>Motivo (opcional)<input maxLength={250} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Folga, manutenção, reunião..."/></label>
          <button type="submit" disabled={loading}>Criar bloqueio</button>
        </form>
        <div className="af-block-list">
          {blocked.map(b=><div className="af-block-item" key={b.id}>
            <div><strong>{b.reason||'Horário bloqueado'}</strong><small>{dateLabel(b.startsAt,timezone)} até {dateLabel(b.endsAt,timezone)}</small></div>
            <button type="button" disabled={loading} onClick={()=>void removeBlock(b.id)}>Remover</button>
          </div>)}
          {!blocked.length&&<p className="af-helper">Nenhum bloqueio futuro registrado.</p>}
        </div>
      </div>
    </div>}
  </div>;
}
