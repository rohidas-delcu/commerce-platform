import type {Reservation} from '../domain/inventory.js';
export interface InventoryRepositoryPort {
  reserve(input:Reservation,actor:string):Promise<Reservation>;
  find(storeId:string,id:string):Promise<Reservation|null>;
  transition(storeId:string,id:string,operation:'release'|'expire'|'commit',actor:string,now:Date):Promise<Reservation>;
  expired(storeId:string,now:Date,limit:number):Promise<string[]>;
}
