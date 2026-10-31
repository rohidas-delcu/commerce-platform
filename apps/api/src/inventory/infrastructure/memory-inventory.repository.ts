import {randomUUID} from 'node:crypto';
import {DomainError,type Product,type Store,type InventoryMovement} from '../../domain/commerce.js';
import {availableStock,reservationReplay,reservationTransition,type Reservation} from '../domain/inventory.js';
import type {InventoryRepositoryPort} from '../application/inventory.port.js';
const clone=<T>(value:T):T=>structuredClone(value);
export class MemoryInventoryRepository implements InventoryRepositoryPort {
  private reservations=new Map<string,Reservation>();
  constructor(private stores:Map<string,Store>,private products:Map<string,Product>,private movements:InventoryMovement[]){}
  async find(storeId:string,id:string){const row=this.reservations.get(id);return row?.storeId===storeId?clone(row):null;}
  private variant(storeId:string,id:string){for(const product of this.products.values())if(product.storeId===storeId){const variant=product.variants.find(v=>v.id===id);if(variant)return{product,variant};}throw new DomainError('NOT_FOUND','Variant not found.');}
  async reserve(input:Reservation,_actor:string){
    const prior=[...this.reservations.values()].find(r=>r.storeId===input.storeId&&r.key===input.key);if(prior)return clone(reservationReplay(prior,input));
    const store=this.stores.get(input.storeId);if(!store||store.status!=='PUBLISHED'||store.suspended||store.archivedAt||(store.merchantStatus&&store.merchantStatus!=='ACTIVE'))throw new DomainError('NOT_FOUND','Published store not available.');
    // No await between validation and mutation: a failed multi-line reservation changes nothing.
    const variants=input.lines.map(line=>{const{product,variant}=this.variant(input.storeId,line.variantId);if(product.status!=='ACTIVE'||variant.active===false)throw new DomainError('NOT_FOUND','Purchasable variant not found.');if(availableStock(variant.stock,variant.reserved??0)<line.quantity)throw new DomainError('CONFLICT','Insufficient available stock.');return{variant,quantity:line.quantity};});
    for(const{variant,quantity}of variants)variant.reserved=(variant.reserved??0)+quantity;
    this.reservations.set(input.id,clone(input));return clone(input);
  }
  async transition(storeId:string,id:string,operation:'release'|'expire'|'commit',actor:string,now:Date){
    const row=this.reservations.get(id);if(!row||row.storeId!==storeId)throw new DomainError('NOT_FOUND','Reservation not found.');
    const status=reservationTransition(row.status,operation,row.expiresAt,now);if(status===row.status)return clone(row);
    const variants=row.lines.map(line=>{const{variant}=this.variant(storeId,line.variantId);if((variant.reserved??0)<line.quantity)throw new DomainError('CONFLICT','Inventory reservation is inconsistent.');return{variant,quantity:line.quantity};});
    for(const{variant,quantity}of variants){variant.reserved=(variant.reserved??0)-quantity;if(status==='COMMITTED'){const before=variant.stock;variant.stock-=quantity;this.movements.unshift({id:randomUUID(),storeId,variantId:variant.id,before,after:variant.stock,delta:-quantity,reason:'ORDER_COMMITTED',note:`Reservation ${id}`,actorSubjectId:actor,createdAt:now.toISOString()});}}
    row.status=status;row.updatedAt=now;return clone(row);
  }
  async expired(storeId:string,now:Date,limit:number){return[...this.reservations.values()].filter(r=>r.storeId===storeId&&r.status==='ACTIVE'&&r.expiresAt<=now).sort((a,b)=>a.expiresAt.getTime()-b.expiresAt.getTime()||a.id.localeCompare(b.id)).slice(0,limit).map(r=>r.id);}
}
