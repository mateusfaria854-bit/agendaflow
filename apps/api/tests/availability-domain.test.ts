import assert from 'node:assert/strict';
import {test} from 'node:test';
import {calculateAvailableSlots,parseClock,validateWeeklyWindows,validDate} from '../src/modules/availability/domain.js';

const todayFar='2035-01-01'; // segunda-feira
const weekday=[{weekday:1,startTime:'09:00',endTime:'12:00'},{weekday:1,startTime:'13:00',endTime:'18:00'}];
const base={date:todayFar,zone:'America/Sao_Paulo',durationMinutes:30,windows:weekday,nowMs:0,blocked:[],bookings:[]};
test('valida datas, horários e períodos semanais sem permitir sobreposição',()=>{
  assert.equal(parseClock('23:59'),1439);
  assert.throws(()=>parseClock('24:00'));
  assert.equal(validDate('2035-02-29'),false);
  assert.equal(validDate('2036-02-29'),true);
  assert.throws(()=>validateWeeklyWindows([{weekday:1,startTime:'09:00',endTime:'12:00'},{weekday:1,startTime:'11:00',endTime:'13:00'}]),/sobrepostos/);
  assert.doesNotThrow(()=>validateWeeklyWindows(weekday));
});
test('gera slots regulares, pula almoço e respeita duração',()=>{
  const slots=calculateAvailableSlots(base);
  assert.equal(slots.length,30); // 09:00..11:30 (11) + 13:00..17:30 (19)
  assert.ok(slots.some(s=>s.label==='09:00'));
  assert.ok(slots.some(s=>s.label==='17:30'));
  assert.ok(!slots.some(s=>s.label==='12:00'));
  assert.ok(!slots.some(s=>s.label==='11:45'));
});
test('bloqueios e reservas só removem slots sobrepostos',()=>{
  const all=calculateAvailableSlots(base);
  const busy={startsAt:all[0].startsAt,endsAt:all[0].endsAt};
  const left=calculateAvailableSlots({...base,blocked:[busy]});
  assert.ok(!left.some(s=>s.startsAt===all[0].startsAt));
  assert.ok(!left.some(s=>s.label==='09:15'));
  assert.ok(left.some(s=>s.label==='09:30'));
  const reserved=calculateAvailableSlots({...base,bookings:[busy]});
  assert.equal(reserved.length,left.length);
});
test('não oferece horários no passado, nem finais fora do expediente',()=>{
  const slots=calculateAvailableSlots({...base,nowMs:Date.parse('2035-01-01T15:00:00Z')});
  assert.ok(slots.every(s=>Date.parse(s.startsAt)>Date.parse('2035-01-01T15:00:00Z')));
  assert.deepEqual(calculateAvailableSlots({...base,date:'2035-01-02'}),[]);
});
test('horário de verão: não inventa horários inexistentes',()=>{
  const windows=[{weekday:0,startTime:'01:00',endTime:'04:00'}];
  // Nova York inicia horário de verão em 11/03/2035 (confirma apenas a ausência de horários falsos).
  const slots=calculateAvailableSlots({date:'2035-03-11',zone:'America/New_York',durationMinutes:30,windows,blocked:[],bookings:[],nowMs:0});
  assert.ok(slots.every(s=>Date.parse(s.endsAt)-Date.parse(s.startsAt)===30*60_000));
  assert.equal(new Set(slots.map(s=>s.startsAt)).size,slots.length);
  assert.ok(slots.every(s=>s.label!=='02:00'));
});
