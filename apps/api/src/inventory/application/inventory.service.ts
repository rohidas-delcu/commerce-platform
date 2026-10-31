import {DomainError} from '../../domain/commerce.js';
import {reservationRequest,type ReservationRequest} from '../domain/inventory.js';
import type {InventoryRepositoryPort} from './inventory.port.js';
export class InventoryService {
  constructor(private repository:InventoryRepositoryPort,private clock:()=>Date=()=>new Date()){}
  reserve(storeId:string,input:ReservationRequest,actor:string){return this.repository.reserve(reservationRequest(storeId,input,this.clock()),actor);}
  async find(storeId:string,id:string){const row=await this.repository.find(storeId,id);if(!row)throw new DomainError('NOT_FOUND','Reservation not found.');return row;}
  transition(storeId:string,id:string,operation:'release'|'commit',actor:string){return this.repository.transition(storeId,id,operation,actor,this.clock());}
  async expire(storeId:string,actor:string){
    const now=this.clock(),ids=await this.repository.expired(storeId,now,100);let expired=0;
    for(const id of ids){const result=await this.repository.transition(storeId,id,'expire',actor,now);if(result.status==='EXPIRED')expired++;}
    return{expired,limit:100};
  }
}
