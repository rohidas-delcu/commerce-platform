import type {PageWindow} from '../../application/pagination.js';
import {assertPricingReady} from '../../pricing/domain/pricing.js';
import {PrismaClient, type Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaCommerceRepository} from '../../infrastructure/prisma-commerce.repository.js';
import {IdentityError} from '../../identity/domain/identity.js';
import {assertOwner, assertPermission,closedStoreFinance, assertRemainingOwner, locale, type Permission,type StoreAvailability} from '../domain/access.js';
import type {MerchantRepositoryPort, MerchantPrincipal, StoreSettings, StoreView} from '../application/merchant.port.js';

const storeSelect = {logoAssetId:true,id:true,merchantId:true,name:true,handle:true,status:true,settingsVersion:true,onboardingState:true,countryCode:true,currencyCode:true,timezone:true,contactEmail:true,brandingName:true,suspended:true,archivedAt:true} as const;
export class PrismaMerchantRepository implements MerchantRepositoryPort {
  private client?: PrismaClient;
  private get db() {
    if (!this.client) {
      const connectionString=process.env.DATABASE_URL;
      if (!connectionString) throw new IdentityError(503,'PostgreSQL configuration required.');
      this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:10},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});
    }
    return this.client;
  }
  async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
  async checkHealth(){await Promise.all([this.db.merchantAccount.findFirst({select:{id:true}}),this.db.merchantMembership.findFirst({select:{role:true}}),this.db.storeMembership.findFirst({select:{role:true}}),this.db.merchantInvitation.findFirst({select:{id:true}}),this.db.storeCreation.findFirst({select:{key:true}})]);}
  async onModuleDestroy(){await this.client?.$disconnect();}
  private async transaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>) {
    try{return await this.db.$transaction(work,{timeout:10000});}
    catch(error){
      if(error && typeof error==='object' && 'code' in error && ['P2002','P2034'].includes(String(error.code))) throw new IdentityError(409,'Conflicting handle or concurrent change.');
      throw error;
    }
  }
  private async principal(tx:Prisma.TransactionClient,p:MerchantPrincipal){
    if(!p.identityId) throw new IdentityError(401,'Authentication required.');
    await tx.$queryRaw`SELECT id FROM "Identity" WHERE id=${p.identityId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "IdentitySession" WHERE id=${p.id}::uuid FOR UPDATE`;
    const s=await tx.identitySession.findUnique({where:{id:p.id},include:{identity:true}});
    if(!s || s.scopeKey!=='merchant'||s.identity?.customerStoreId!==null || s.identityId!==p.identityId || s.revokedAt || s.expiresAt<=new Date() || s.absoluteExpiresAt<=new Date() || s.identity?.status!=='ACTIVE' || !s.identity.verifiedAt) throw new IdentityError(401,'Authentication required.');
  }
  private async account(tx:Prisma.TransactionClient,p:MerchantPrincipal,merchantId:string){
    await tx.$queryRaw`SELECT id FROM "MerchantAccount" WHERE id=${merchantId}::uuid FOR UPDATE`;
    const member=await tx.merchantMembership.findUnique({where:{merchantId_identityId:{merchantId,identityId:p.identityId!}},include:{merchant:true}});
    if(!member) throw new IdentityError(404,'Merchant account not found.');
    if(member.merchant.status!=='ACTIVE') throw new IdentityError(403,'Merchant account is unavailable.');
    return member;
  }
  private async scoped<T>(p:MerchantPrincipal,storeId:string,permission:Permission,work:(tx:Prisma.TransactionClient,store:StoreView)=>Promise<T>, allowSuspended=false,financial=false){
    return this.transaction(async tx=>{
      await this.principal(tx,p);
      const preliminary=await tx.store.findUnique({where:{id:storeId},select:{merchantId:true}});
      if(!preliminary) throw new IdentityError(404,'Store not found.');
      const account=await this.account(tx,p,preliminary.merchantId);
      await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${storeId}::uuid FOR UPDATE`;
      const store=await tx.store.findUniqueOrThrow({where:{id:storeId},select:storeSelect});
      const membership=await tx.storeMembership.findUnique({where:{storeId_identityId:{storeId,identityId:p.identityId!}}});
      assertPermission(account.role==='ACCOUNT_OWNER'?'ACCOUNT_OWNER':membership?.role??null,permission);
      if(!financial&&(store.archivedAt || (store.suspended && !allowSuspended))) throw new IdentityError(403,'Store is unavailable.');
      return work(tx,store);
    });
  }

  async accountStatus(p:MerchantPrincipal,merchantId:string,suspended:boolean){return this.transaction(async tx=>{
    await this.principal(tx,p);
    await tx.$queryRaw`SELECT id FROM "MerchantAccount" WHERE id=${merchantId}::uuid FOR UPDATE`;
    const member=await tx.merchantMembership.findUnique({where:{merchantId_identityId:{merchantId,identityId:p.identityId!}},include:{merchant:true}});
    if(!member)throw new IdentityError(404,'Account not found.');assertOwner(member.role);
    if(!['ACTIVE','SUSPENDED'].includes(member.merchant.status))throw new IdentityError(403,'Account requires operator recovery.');
    const account=await tx.merchantAccount.update({where:{id:merchantId},data:{status:suspended?'SUSPENDED':'ACTIVE'},select:{id:true,name:true,status:true}});
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`ACCOUNT_${suspended?'SUSPENDED':'RESUMED'}:${merchantId}`}});return account;
  });}
  storeStatus(p:MerchantPrincipal,id:string,operation:'suspend'|'resume'|'archive'){return this.scoped(p,id,'members.manage',async(tx,store)=>{
    if(operation==='archive' && store.status==='PUBLISHED')throw new IdentityError(409,'Unpublish before archival.');
    const result=await tx.store.update({where:{id},data:operation==='archive'?{archivedAt:new Date()}:{suspended:operation==='suspend'},select:storeSelect});
    if(operation==='archive')await tx.merchantInvitation.updateMany({where:{storeId:id,consumedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`STORE_${operation.toUpperCase()}:${id}`}});return result;
  },true);}
  async createAccount(p:MerchantPrincipal,name:string){
    return this.transaction(async tx=>{await this.principal(tx,p);return tx.merchantAccount.create({data:{name,members:{create:{identityId:p.identityId!,role:'ACCOUNT_OWNER'}}},select:{id:true,name:true,status:true}});});
  }
  async accounts(p:MerchantPrincipal,page:PageWindow){return this.transaction(async tx=>{await this.principal(tx,p);return tx.merchantAccount.findMany({where:{members:{some:{identityId:p.identityId!}}},select:{id:true,name:true,status:true},take:page.limit+1,skip:page.offset,orderBy:[{createdAt:'asc'},{id:'asc'}]});});}
  async createStore(p:MerchantPrincipal,merchantId:string,input:{name:string;handle:string;countryCode:string;currencyCode:string},key:string,digest:string){
    return this.transaction(async tx=>{
      await this.principal(tx,p);assertOwner((await this.account(tx,p,merchantId)).role);
      const prior=await tx.storeCreation.findUnique({where:{identityId_key:{identityId:p.identityId!,key}}});
      if(prior){if(prior.merchantId!==merchantId || prior.digest!==digest)throw new IdentityError(409,'Idempotency key already used for different input.');return tx.store.findUniqueOrThrow({where:{id:prior.storeId},select:storeSelect});}
      const store=await tx.store.create({data:{...input,merchantId,ownerSubjectId:p.identityId!,brandingName:input.name,creation:{create:{identityId:p.identityId!,key,digest}}},select:storeSelect});
      await tx.identityAudit.create({data:{identityId:p.identityId!,action:`STORE_CREATED:${store.id}`}});
      return store;
    });
  }
  async stores(p:MerchantPrincipal,page:PageWindow){return this.transaction(async tx=>{
    await this.principal(tx,p);
    return tx.store.findMany({where:{archivedAt:null,merchant:{status:'ACTIVE',members:{some:{identityId:p.identityId!}}},OR:[{merchant:{members:{some:{identityId:p.identityId!,role:'ACCOUNT_OWNER'}}}},{memberships:{some:{identityId:p.identityId!}}}]},select:storeSelect,take:page.limit+1,skip:page.offset,orderBy:[{createdAt:'asc'},{id:'asc'}]});
  });}
  withStore<T>(p:MerchantPrincipal,storeId:string,permission:Permission,work:(repo:PrismaCommerceRepository,store:StoreView)=>Promise<T>,availability:StoreAvailability='operational'){return this.scoped(p,storeId,permission,(tx,store)=>work(new PrismaCommerceRepository(tx),store),false,closedStoreFinance(permission,availability));}
  settings(p:MerchantPrincipal,storeId:string,input:StoreSettings){return this.scoped(p,storeId,'store.settings',async(tx,store)=>{
    if(input.expectedVersion!==store.settingsVersion)throw new IdentityError(409,'Settings changed. Reload before saving.');
    const {expectedVersion,...changes}=input;
    const country=changes.countryCode??store.countryCode,currency=changes.currencyCode??store.currencyCode;locale(country,currency);
    if(currency!==store.currencyCode && (await tx.product.count({where:{storeId}})||await tx.storePricing.count({where:{storeId}})||await tx.discountCoupon.count({where:{storeId}})))throw new IdentityError(409,'Currency cannot change after catalog or pricing configuration exists.');
    if(changes.logoAssetId!==undefined&&changes.logoAssetId!==null){
      await tx.$queryRaw`SELECT id FROM "MediaAsset" WHERE id=${changes.logoAssetId}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
      if(!await tx.mediaAsset.count({where:{id:changes.logoAssetId,storeId,status:'COMPLETE'}}))throw new IdentityError(400,'Logo must be a verified asset of this store.');
    }
    const updated=await tx.store.update({where:{id:storeId,settingsVersion:expectedVersion},data:{...changes,settingsVersion:{increment:1}},select:storeSelect});
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`STORE_SETTINGS_CHANGED:${storeId}`}});return updated;
  });}
  complete(p:MerchantPrincipal,storeId:string,version:number){return this.scoped(p,storeId,'store.settings',async(tx,store)=>{
    if(store.onboardingState==='COMPLETED')return store;
    if(store.settingsVersion!==version)throw new IdentityError(409,'Settings changed.');
    if(!store.name.trim() || !store.contactEmail || !store.brandingName.trim())throw new IdentityError(409,'Store information, contact email and branding are required.');
    locale(store.countryCode,store.currencyCode);
    assertPricingReady(await new PrismaCommerceRepository(tx).pricing.policy(storeId));
    return tx.store.update({where:{id:storeId},data:{onboardingState:'COMPLETED',settingsVersion:{increment:1}},select:storeSelect});
  });}
  publication(p:MerchantPrincipal,storeId:string,published:boolean){return this.scoped(p,storeId,'store.publish',async(tx,store)=>{
    if(published && store.onboardingState!=='COMPLETED')throw new IdentityError(409,'Complete onboarding before publication.');
    if(published)assertPricingReady(await new PrismaCommerceRepository(tx).pricing.policy(storeId));
    const updated=await tx.store.update({where:{id:storeId},data:{status:published?'PUBLISHED':'DRAFT'},select:storeSelect});
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`STORE_${published?'PUBLISHED':'UNPUBLISHED'}:${storeId}`}});return updated;
  });}
  async members(p:MerchantPrincipal,merchantId:string,page:PageWindow){return this.transaction(async tx=>{await this.principal(tx,p);assertOwner((await this.account(tx,p,merchantId)).role);return tx.merchantMembership.findMany({where:{merchantId},select:{identityId:true,role:true},take:page.limit+1,skip:page.offset,orderBy:{identityId:'asc'}});});}
  async membership(p:MerchantPrincipal,merchantId:string,identityId:string,role:'ACCOUNT_OWNER'|'MEMBER'|null){return this.transaction(async tx=>{
    await this.principal(tx,p);assertOwner((await this.account(tx,p,merchantId)).role);
    const current=await tx.merchantMembership.findUnique({where:{merchantId_identityId:{merchantId,identityId}},include:{identity:true}});
    if(!current)throw new IdentityError(404,'Membership not found. Use an invitation to add members.');
    if(role==='ACCOUNT_OWNER' && (current.identity.status!=='ACTIVE' || !current.identity.verifiedAt))throw new IdentityError(409,'Owner must be active and verified.');
    if(current.role==='ACCOUNT_OWNER' && role!=='ACCOUNT_OWNER')assertRemainingOwner(await tx.merchantMembership.count({where:{merchantId,identityId:{not:identityId},role:'ACCOUNT_OWNER',identity:{status:'ACTIVE',verifiedAt:{not:null}}}}));
    if(current.role==='ACCOUNT_OWNER' && role!=='ACCOUNT_OWNER')await tx.merchantInvitation.updateMany({where:{merchantId,inviterId:identityId,consumedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
    if(role)await tx.merchantMembership.update({where:{merchantId_identityId:{merchantId,identityId}},data:{role}});
    else {await tx.storeMembership.deleteMany({where:{merchantId,identityId}});await tx.merchantMembership.delete({where:{merchantId_identityId:{merchantId,identityId}}});}
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`MEMBERSHIP_CHANGED:${merchantId}:${identityId}`}});
  });}
  async invite(p:MerchantPrincipal,merchantId:string,storeId:string|null,email:string,role:string,tokenDigest:string,mail:string){return this.transaction(async tx=>{
    await this.principal(tx,p);assertOwner((await this.account(tx,p,merchantId)).role);
    if(storeId && !await tx.store.findFirst({where:{id:storeId,merchantId,archivedAt:null,suspended:false}}))throw new IdentityError(404,'Store not found.');
    await tx.merchantInvitation.updateMany({where:{merchantId,storeId,email,consumedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
    const invitation=await tx.merchantInvitation.create({data:{merchantId,storeId,email,role,inviterId:p.identityId!,digest:tokenDigest,expiresAt:new Date(Date.now()+72*3600000)},select:{id:true,email:true,role:true,expiresAt:true}});
    await tx.identityMail.create({data:{recipient:email,purpose:'INVITE',encryptedPayload:mail}});
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`INVITED:${invitation.id}`}});return invitation;
  });}
  async invitations(p:MerchantPrincipal,merchantId:string,page:PageWindow){return this.transaction(async tx=>{
    await this.principal(tx,p);assertOwner((await this.account(tx,p,merchantId)).role);
    return tx.merchantInvitation.findMany({where:{merchantId},select:{id:true,email:true,role:true,expiresAt:true,consumedAt:true,revokedAt:true},take:page.limit+1,skip:page.offset,orderBy:[{expiresAt:'desc'},{id:'asc'}]});
  });}
  async revokeInvitation(p:MerchantPrincipal,merchantId:string,id:string){return this.transaction(async tx=>{
    await this.principal(tx,p);assertOwner((await this.account(tx,p,merchantId)).role);
    const result=await tx.merchantInvitation.updateMany({where:{id,merchantId,consumedAt:null},data:{revokedAt:new Date()}});
    if(!result.count)throw new IdentityError(404,'Pending invitation not found.');
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`INVITATION_REVOKED:${id}`}});
  });}
  async accept(p:MerchantPrincipal,tokenDigest:string){return this.transaction(async tx=>{
    await this.principal(tx,p);
    const invitation=await tx.merchantInvitation.findUnique({where:{digest:tokenDigest}});
    if(!invitation)throw new IdentityError(400,'Invalid invitation.');
    await tx.$queryRaw`SELECT id FROM "MerchantAccount" WHERE id=${invitation.merchantId}::uuid FOR UPDATE`;
    const account=await tx.merchantAccount.findUniqueOrThrow({where:{id:invitation.merchantId}});
    const identity=await tx.identity.findUniqueOrThrow({where:{id:p.identityId!}});
    const issuer=await tx.merchantMembership.findUnique({where:{merchantId_identityId:{merchantId:account.id,identityId:invitation.inviterId}},include:{identity:true}});
    if(account.status!=='ACTIVE' || identity.email!==invitation.email || issuer?.role!=='ACCOUNT_OWNER' || issuer.identity.status!=='ACTIVE' || !issuer.identity.verifiedAt)throw new IdentityError(400,'Invalid invitation.');
    if(invitation.storeId){
      await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${invitation.storeId}::uuid FOR UPDATE`;
      if(!await tx.store.findFirst({where:{id:invitation.storeId,merchantId:account.id,archivedAt:null,suspended:false}}))throw new IdentityError(400,'Invalid invitation.');
    }
    const used=await tx.merchantInvitation.updateMany({where:{id:invitation.id,consumedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
    if(!used.count)throw new IdentityError(400,'Invalid or expired invitation.');
    await tx.merchantMembership.upsert({where:{merchantId_identityId:{merchantId:account.id,identityId:p.identityId!}},create:{merchantId:account.id,identityId:p.identityId!,role:'MEMBER'},update:{}});
    if(invitation.storeId)await tx.storeMembership.upsert({where:{storeId_identityId:{storeId:invitation.storeId,identityId:p.identityId!}},create:{storeId:invitation.storeId,merchantId:account.id,identityId:p.identityId!,role:invitation.role},update:{}});
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`INVITATION_ACCEPTED:${invitation.id}`}});
  });}
  async storeMember(p:MerchantPrincipal,storeId:string,identityId:string,role:string|null){return this.scoped(p,storeId,'members.manage',async(tx,store)=>{
    const target=await tx.merchantMembership.findUnique({where:{merchantId_identityId:{merchantId:store.merchantId,identityId}}});
    if(!target)throw new IdentityError(404,'Account member not found.');
    if(target.role==='ACCOUNT_OWNER')throw new IdentityError(409,'Account owners have inherited store access. Manage account ownership instead.');
    if(role)await tx.storeMembership.upsert({where:{storeId_identityId:{storeId,identityId}},create:{storeId,merchantId:store.merchantId,identityId,role},update:{role}});
    else await tx.storeMembership.deleteMany({where:{storeId,identityId}});
    await tx.identityAudit.create({data:{identityId:p.identityId!,action:`STORE_MEMBERSHIP_CHANGED:${storeId}:${identityId}`}});
  });}

}
