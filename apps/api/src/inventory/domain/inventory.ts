import {createHash,randomUUID} from 'node:crypto';
import {DomainError} from '../../domain/commerce.js';
export type ReservationStatus='ACTIVE'|'RELEASED'|'EXPIRED'|'COMMITTED';
export interface ReservationLine {variantId:string;quantity:number;}
export interface Reservation {
  id:string;storeId:string;key:string;digest:string;status:ReservationStatus;
  expiresAt:Date;createdAt:Date;updatedAt:Date;lines:ReservationLine[];
}
export interface ReservationRequest {key:string;lines:ReservationLine[];ttlSeconds?:number;}
export function reservationRequest(storeId:string,input:ReservationRequest,now:Date):Reservation {
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(input.key)||!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>100)throw new DomainError('INVALID','A stable key and 1–100 reservation lines are required.');
  const ttlSeconds=input.ttlSeconds??900;
  if(!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>1800)throw new DomainError('INVALID','Reservation lifetime must be 60–1800 seconds.');
  const seen=new Set<string>();
  const lines=input.lines.map(line=>{
    if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(line.variantId)||seen.has(line.variantId)||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>1000000)throw new DomainError('INVALID','Reservation lines require unique variants and positive bounded quantities.');
    seen.add(line.variantId);return{variantId:line.variantId,quantity:line.quantity};
  }).sort((a,b)=>a.variantId.localeCompare(b.variantId));
  const digest=createHash('sha256').update(JSON.stringify({storeId,lines,ttlSeconds})).digest('hex');
  return{id:randomUUID(),storeId,key:input.key,digest,status:'ACTIVE',expiresAt:new Date(now.getTime()+ttlSeconds*1000),createdAt:now,updatedAt:now,lines};
}
export function reservationReplay(existing:Reservation,requested:Reservation){if(existing.digest!==requested.digest)throw new DomainError('CONFLICT','Reservation key already used for different input.');return existing;}
export function reservationTransition(status:ReservationStatus,operation:'release'|'expire'|'commit',expiresAt:Date,now:Date):ReservationStatus {
  if(operation==='commit'){
    if(status==='COMMITTED')return status;
    if(status!=='ACTIVE'||expiresAt<=now)throw new DomainError('CONFLICT','Reservation is unavailable or expired.');
    return 'COMMITTED';
  }
  if(status==='COMMITTED'&&operation==='expire')return status;
  if(status==='COMMITTED')throw new DomainError('CONFLICT','Committed stock cannot be released as an active reservation.');
  if(status!=='ACTIVE')return status;
  if(operation==='expire'&&expiresAt>now)throw new DomainError('CONFLICT','Reservation has not expired.');
  return expiresAt<=now?'EXPIRED':'RELEASED';
}
export function availableStock(onHand:number,reserved:number){
  if(!Number.isSafeInteger(onHand)||!Number.isSafeInteger(reserved)||reserved<0||onHand<reserved)throw new DomainError('CONFLICT','Inventory is inconsistent.');
  return onHand-reserved;
}
