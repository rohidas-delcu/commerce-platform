import type {PrismaClient,Prisma} from '../../generated/prisma/client.js';
import {DomainError} from '../../domain/commerce.js';
import {reservationReplay,reservationTransition,availableStock,type Reservation,type ReservationStatus} from '../domain/inventory.js';
import type {InventoryRepositoryPort} from '../application/inventory.port.js';
const include={lines:{select:{variantId:true,quantity:true},orderBy:{variantId:'asc' as const}}};
function domain(row:Omit<Reservation,'status'>&{status:string}):Reservation{return{...row,status:row.status as ReservationStatus};}
export class PrismaInventoryRepository implements InventoryRepositoryPort {
  constructor(private db:PrismaClient|Prisma.TransactionClient){}
  private transaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>){return '$transaction'in this.db?this.db.$transaction(work,{timeout:15000}):work(this.db);}
  async find(storeId:string,id:string){const row=await this.db.inventoryReservation.findFirst({where:{id,storeId},include});return row?domain(row):null;}
  async reserve(input:Reservation,actor:string){return this.transaction(async tx=>{
    // Store lock serializes absent-key creation and protects store publication state.
    // Merchant authorization acquires account/store locks in this same order first.
    await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${input.storeId}::uuid FOR UPDATE`;
    const prior=await tx.inventoryReservation.findUnique({where:{storeId_key:{storeId:input.storeId,key:input.key}},include});
    if(prior)return reservationReplay(domain(prior),input);
    const store=await tx.store.findFirst({where:{id:input.storeId,status:'PUBLISHED',suspended:false,archivedAt:null,merchant:{status:'ACTIVE'}},select:{id:true}});
    if(!store)throw new DomainError('NOT_FOUND','Published store not available.');
    for(const line of input.lines){
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id=${line.variantId}::uuid AND "storeId"=${input.storeId}::uuid FOR UPDATE`;
      const variant=await tx.productVariant.findFirst({where:{id:line.variantId,storeId:input.storeId,active:true,product:{status:'ACTIVE'}}});
      if(!variant)throw new DomainError('NOT_FOUND','Purchasable variant not found.');
      if(availableStock(variant.stock,variant.reserved)<line.quantity)throw new DomainError('CONFLICT','Insufficient available stock.');
      await tx.productVariant.update({where:{id:variant.id},data:{reserved:{increment:line.quantity}}});
    }
    const{lines,...data}=input;
    const row=await tx.inventoryReservation.create({data:{...data,lines:{create:lines},events:{create:{status:'ACTIVE',actor}}},include});return domain(row);
  });}
  async transition(storeId:string,id:string,operation:'release'|'expire'|'commit',actor:string,now:Date){return this.transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${storeId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "InventoryReservation" WHERE id=${id}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
    const row=await tx.inventoryReservation.findFirst({where:{id,storeId},include});if(!row)throw new DomainError('NOT_FOUND','Reservation not found.');
    const [clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;
    const effectiveNow=new Date(Math.max(now.getTime(),clock.now.getTime()));
    const status=reservationTransition(row.status as ReservationStatus,operation,row.expiresAt,effectiveNow);if(status===row.status)return domain(row);
    for(const line of row.lines){
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id=${line.variantId}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
      const variant=await tx.productVariant.findFirstOrThrow({where:{id:line.variantId,storeId}});
      if(variant.reserved<line.quantity)throw new DomainError('CONFLICT','Inventory reservation is inconsistent.');
      await tx.productVariant.update({where:{id:variant.id},data:{reserved:{decrement:line.quantity},...(status==='COMMITTED'?{stock:{decrement:line.quantity}}:{})}});
      if(status==='COMMITTED')await tx.inventoryMovement.create({data:{storeId,variantId:variant.id,before:variant.stock,after:variant.stock-line.quantity,delta:-line.quantity,reason:'ORDER_COMMITTED',note:`Reservation ${id}`,actorSubjectId:actor}});
    }
    const saved=await tx.inventoryReservation.update({where:{id},data:{status,updatedAt:effectiveNow,events:{create:{status,actor}}},include});return domain(saved);
  });}
  async expired(storeId:string,now:Date,limit:number){return(await this.db.inventoryReservation.findMany({where:{storeId,status:'ACTIVE',expiresAt:{lte:now}},orderBy:[{expiresAt:'asc'},{id:'asc'}],take:limit,select:{id:true}})).map(row=>row.id);}
}
