import type {Prisma} from '../../generated/prisma/client.js';
import {DomainError} from '../../domain/commerce.js';
const inFlight=['INITIATING','PENDING','UNKNOWN','CAPTURED','REVIEW_REQUIRED'];
export async function assertCheckoutPaymentMutable(tx:Prisma.TransactionClient,checkoutId:string){if(await tx.paymentAttempt.findFirst({where:{checkoutId,status:{in:inFlight}},select:{id:true}}))throw new DomainError('CONFLICT','Payment is in progress or requires reconciliation.');}
export async function assertCartPaymentMutable(tx:Prisma.TransactionClient,cartId:string){if(await tx.paymentAttempt.findFirst({where:{checkout:{cartId},status:{in:inFlight}},select:{id:true}}))throw new DomainError('CONFLICT','Cart is attached to a payment in progress.');}
