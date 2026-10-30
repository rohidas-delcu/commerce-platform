import type {PrismaClient,Prisma} from '../generated/prisma/client.js';
import {IdentityError,type BrowserSession} from '../identity/domain/identity.js';
import {DomainError} from '../domain/commerce.js';
/** Shared transactional authority check for customer and anonymous storefront use cases. */
export function withStorefrontSession<T>(db:PrismaClient,storeId:string,p:BrowserSession,member:boolean,work:(tx:Prisma.TransactionClient,identityId:string|null)=>Promise<T>,access:'commerce'|'account'='commerce'){return db.$transaction(async tx=>{
  if(member&&!p.identityId)throw new IdentityError(401,'Authentication required.');
  if(p.identityId)await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${p.identityId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "IdentitySession" WHERE id=${p.id}::uuid FOR UPDATE`;
  const session=await tx.identitySession.findFirst({where:{id:p.id,identityId:p.identityId,scopeKey:'store:'+storeId,revokedAt:null,expiresAt:{gt:new Date()},absoluteExpiresAt:{gt:new Date()}},include:{identity:true}});
  if(!session||(session.identityId&&(!session.identity||session.identity.customerStoreId!==storeId||session.identity.status!=='ACTIVE'||!session.identity.verifiedAt)))throw new IdentityError(401,'Authentication required.');
  const preliminary=await tx.store.findUnique({where:{id:storeId},select:{merchantId:true}});if(!preliminary)throw new DomainError('NOT_FOUND','Store not found.');
  await tx.$queryRaw`SELECT id FROM "MerchantAccount" WHERE id=${preliminary.merchantId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${storeId}::uuid FOR UPDATE`;
  if(!await tx.store.count({where:{id:storeId,...(access==='commerce'?{status:'PUBLISHED' as const,suspended:false,archivedAt:null,merchant:{status:'ACTIVE'}}:{})}}))throw new DomainError('NOT_FOUND','Store not found.');
  if(session.expiresAt<=new Date()||session.absoluteExpiresAt<=new Date())throw new IdentityError(401,'Authentication required.');
  return work(tx,session.identityId);
});}
