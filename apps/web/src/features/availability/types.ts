export type Service = {id:string;name:string;durationMinutes:number;priceCents:number;active:boolean};
export type Professional = {id:string;name:string;active:boolean;services:Array<{id:string;name:string;active:boolean}>};
export type WeeklyWindow = {weekday:number;startTime:string;endTime:string};
export type BlockedPeriod = {id:string;startsAt:string;endsAt:string;reason:string|null};
export type SlotsResult = {
  date:string;timezone:string;professionalId:string;serviceId:string;durationMinutes:number;
  slots:Array<{startsAt:string;endsAt:string;label:string;offset:string}>;
};
export const WEEKDAYS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
