import type {Prisma} from '../../generated/prisma/client.js';
// Caller owns the store lock. No cart expiry ever deducts or restores on-hand stock.
export async function expireCart(tx:Prisma.TransactionClient,id:string,now:Date){return(await tx.cart.updateMany({where:{id,status:'ACTIVE',expiresAt:{lte:now}},data:{status:'EXPIRED',version:{increment:1}}})).count===1;}
