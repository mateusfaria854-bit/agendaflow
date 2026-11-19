/** Contracts shared between the web client and the HTTP API. */
export const APP_NAME = 'AgendaFlow' as const;
export type UserRole = 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN';
export type AppointmentStatus = 'PENDENTE' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';
export type HealthResponse = { status: 'ok'; service: 'agendaflow-api'; version: string };
export type ReadyResponse = { status: 'ready' | 'unavailable' };

/** Half-open intervals: [start, end). Adjacent bookings do not overlap. */
export function intervalsOverlap(
  firstStart: number, firstEnd: number, secondStart: number, secondEnd: number,
): boolean {
  const times = [firstStart, firstEnd, secondStart, secondEnd];
  if (times.some(value => !Number.isFinite(value))) throw new Error('Invalid time value');
  if (firstStart >= firstEnd || secondStart >= secondEnd) throw new Error('End must follow start');
  return firstStart < secondEnd && secondStart < firstEnd;
}
