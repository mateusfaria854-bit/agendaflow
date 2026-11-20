/** Regras puras de disponibilidade, sem SQL, HTTP ou navegador. */
export type WeeklyWindow = {weekday: number; startTime: string; endTime: string};
export type ReservedWindow = {startsAt: string; endsAt: string};
export type AvailableSlot = {startsAt: string; endsAt: string; label: string; offset: string};

const STEP_MINUTES = 15;
const MINUTE = 60_000;

export function parseClock(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error('Horário inválido. Utilize HH:MM em formato de 24 horas.');
  }
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function validateWeeklyWindows(windows: WeeklyWindow[]): void {
  if (windows.length > 80) throw new Error('Limite de 80 períodos semanais excedido.');
  const byDay = new Map<number, Array<{start: number; end: number}>>();
  for (const window of windows) {
    if (!Number.isInteger(window.weekday) || window.weekday < 0 || window.weekday > 6) {
      throw new Error('Dia da semana inválido.');
    }
    const start = parseClock(window.startTime), end = parseClock(window.endTime);
    if (end <= start) throw new Error('O fim do expediente precisa ser depois do início.');
    const day = byDay.get(window.weekday) ?? [];
    day.push({start, end});
    byDay.set(window.weekday, day);
  }
  for (const intervals of byDay.values()) {
    intervals.sort((a,b) => a.start-b.start);
    for (let i=1; i<intervals.length; i++) {
      if (intervals[i].start < intervals[i-1].end) throw new Error('Há expedientes sobrepostos no mesmo dia.');
    }
  }
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}

export function isOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function getBusinessDay(timestamp: number, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit'}).format(timestamp);
}

type Wall = {date: string; minutes: number};
function wallParts(date: Date, formatter: Intl.DateTimeFormat): Wall {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`, minutes:Number(parts.hour)*60+Number(parts.minute)};
}

/**
 * Itera sobre instantes UTC em uma janela que cobre todo o dia local, inclusive
 * quando um fuso tem horário de verão. Não cria instantes que não existem.
 * Horários que atravessam uma troca de offset são descartados para evitar
 * atendimentos de duração inesperada no relógio do negócio.
 */
export function calculateAvailableSlots(input: {
  date: string;
  zone: string;
  durationMinutes: number;
  windows: WeeklyWindow[];
  blocked: ReservedWindow[];
  bookings: ReservedWindow[];
  nowMs?: number;
}): AvailableSlot[] {
  const {date, zone, durationMinutes, windows, blocked, bookings} = input;
  if (!validDate(date)) throw new Error('Data inválida.');
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    throw new Error('Duração inválida.');
  }
  validateWeeklyWindows(windows);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23',
  });
  const offsetFormat = new Intl.DateTimeFormat('en-GB', {timeZone:zone,timeZoneName:'shortOffset'});
  const offsetFor = (stamp: number) => offsetFormat.formatToParts(new Date(stamp)).find(part=>part.type==='timeZoneName')?.value ?? '';
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  const dayWindows = windows.filter(w=>w.weekday===weekday).map(w=>({
    start:parseClock(w.startTime),end:parseClock(w.endTime),
  }));
  if (!dayWindows.length) return [];
  const busy = [...blocked,...bookings].map(w=>[Date.parse(w.startsAt),Date.parse(w.endsAt)] as const);
  if (busy.some(([a,b])=>!Number.isFinite(a)||!Number.isFinite(b)||a>=b)) {
    throw new Error('Intervalo bloqueado inválido.');
  }
  const now = input.nowMs ?? Date.now();
  // O dia local pode começar até 14 horas distante do UTC.
  const base = Date.parse(date+'T00:00:00Z');
  const candidates: AvailableSlot[] = [];
  for (let t=base-18*60*MINUTE; t<base+42*60*MINUTE; t+=STEP_MINUTES*MINUTE) {
    if (t <= now) continue;
    const wall=wallParts(new Date(t),formatter);
    if (wall.date!==date || wall.minutes%STEP_MINUTES!==0) continue;
    if (!dayWindows.some(w=>wall.minutes>=w.start&&wall.minutes+durationMinutes<=w.end)) continue;
    const end=t+durationMinutes*MINUTE;
    const endWall=wallParts(new Date(end),formatter);
    if (endWall.date!==date || endWall.minutes!==wall.minutes+durationMinutes) continue;
    if (offsetFor(t)!==offsetFor(end)) continue;
    if (busy.some(([busyStart,busyEnd])=>isOverlap(t,end,busyStart,busyEnd))) continue;
    const label=`${String(Math.floor(wall.minutes/60)).padStart(2,'0')}:${String(wall.minutes%60).padStart(2,'0')}`;
    candidates.push({startsAt:new Date(t).toISOString(),endsAt:new Date(end).toISOString(),label,offset:offsetFor(t)});
  }
  return candidates.sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
