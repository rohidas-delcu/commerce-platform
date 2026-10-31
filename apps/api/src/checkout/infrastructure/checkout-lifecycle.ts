import type {Prisma} from '../../generated/prisma/client.js';
import {InventoryService} from '../../inventory/application/inventory.service.js';
import {PrismaInventoryRepository} from '../../inventory/infrastructure/prisma-inventory.repository.js';
type Row=Prisma.CheckoutGetPayload<object>;
export async function databaseTime(tx:Prisma.TransactionClient){const[clock]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`;return clock.now;}
// Caller owns account -> store -> checkout locks. Used by request and trusted worker paths.
export async function releaseCheckout(tx:Prisma.TransactionClient,row:Row,actor:string){
  if(row.reservationId)await new InventoryService(new PrismaInventoryRepository(tx)).transition(row.storeId,row.reservationId,'release',actor);
  const now=await databaseTime(tx);
  await tx.couponHold.updateMany({where:{checkoutId:row.id,storeId:row.storeId,checkoutVersion:row.version,status:'HELD',expiresAt:{lte:now}},data:{status:'EXPIRED',closedAt:now}});
  await tx.couponHold.updateMany({where:{checkoutId:row.id,storeId:row.storeId,checkoutVersion:row.version,status:'HELD'},data:{status:'RELEASED',closedAt:now}});
}
export async function expireCheckout(tx:Prisma.TransactionClient,row:Row,identityId:string|null){
  const now=await databaseTime(tx);
  if(!['DRAFT','READY'].includes(row.status)||row.expiresAt>now)return row;
  await releaseCheckout(tx,row,identityId??'system:expiry');
  await tx.identityAudit.create({data:{identityId,action:'CHECKOUT_EXPIRED:'+row.id}});
  return tx.checkout.update({where:{id:row.id},data:{status:'EXPIRED',version:{increment:1},reservationId:null}});
}
