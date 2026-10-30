import {withStorefrontSession} from '../../infrastructure/storefront-session.js';
import {PrismaClient,type Prisma} from '../../generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import {IdentityError,type BrowserSession} from '../../identity/domain/identity.js';
import {DomainError} from '../../domain/commerce.js';
import {customerAddress,type AddressInput} from '../domain/customer.js';
import type {CustomerRepositoryPort} from '../application/customer.port.js';
const select={id:true,name:true,line1:true,line2:true,city:true,region:true,postalCode:true,countryCode:true,phone:true,isDefault:true,version:true};
export class PrismaCustomerRepository implements CustomerRepositoryPort {
  private client?:PrismaClient;
  private get db(){if(this.client)return this.client;const connectionString=process.env.DATABASE_URL;if(!connectionString)throw new Error('DATABASE_URL required.');return this.client=new PrismaClient({adapter:new PrismaPg({connectionString,connectionTimeoutMillis:5000,max:10},{schema:new URL(connectionString).searchParams.get('schema')??'public'})});}
  async onModuleInit(){if(process.env.DATA_DRIVER==='postgres')await this.checkHealth();}
  async onModuleDestroy(){await this.client?.$disconnect();}
  async checkHealth(){await Promise.all([this.db.customerAddress.findFirst({select:{id:true}}),this.db.customerWishlist.findFirst({select:{productId:true}})]);}
  private scope<T>(storeId:string,p:BrowserSession,work:(tx:Prisma.TransactionClient,customerId:string)=>Promise<T>){return withStorefrontSession(this.db,storeId,p,true,(tx,customerId)=>{
    if(!customerId)throw new IdentityError(401,'Authentication required.');return work(tx,customerId);
  });}
  addresses(storeId:string,p:BrowserSession){return this.scope(storeId,p,(tx,customerId)=>tx.customerAddress.findMany({where:{customerId,storeId},select,orderBy:[{isDefault:'desc'},{createdAt:'asc'},{id:'asc'}],take:20}));}
  saveAddress(storeId:string,p:BrowserSession,input:AddressInput,id?:string,version?:number){const data=customerAddress(input);return this.scope(storeId,p,async(tx,customerId)=>{
    const current=id?await tx.customerAddress.findFirst({where:{id,storeId,customerId}}):null;
    if(id&&!current)throw new DomainError('NOT_FOUND','Address not found.');
    if(current&&current.version!==version)throw new DomainError('CONFLICT','Address changed.');
    const count=await tx.customerAddress.count({where:{customerId,storeId}});
    if(!id&&count>=20)throw new DomainError('CONFLICT','Address limit reached.');
    if(current?.isDefault&&input.isDefault===false)throw new DomainError('CONFLICT','Select another default address before clearing this default.');
    const isDefault=(input.isDefault??current?.isDefault??false)||count===0;
    if(isDefault)await tx.customerAddress.updateMany({where:{customerId,storeId,isDefault:true,...(id?{id:{not:id}}:{})},data:{isDefault:false,version:{increment:1}}});
    return current?tx.customerAddress.update({where:{id:current.id},data:{...data,isDefault,version:{increment:1}},select}):tx.customerAddress.create({data:{...data,isDefault,storeId,customerId},select});
  });}
  removeAddress(storeId:string,p:BrowserSession,id:string,version:number){return this.scope(storeId,p,async(tx,customerId)=>{
    const current=await tx.customerAddress.findFirst({where:{id,customerId,storeId}});if(!current)throw new DomainError('NOT_FOUND','Address not found.');if(current.version!==version)throw new DomainError('CONFLICT','Address changed.');
    await tx.customerAddress.delete({where:{id}});
    if(current.isDefault){const next=await tx.customerAddress.findFirst({where:{customerId,storeId},orderBy:[{createdAt:'asc'},{id:'asc'}]});if(next)await tx.customerAddress.update({where:{id:next.id},data:{isDefault:true,version:{increment:1}}});}
  });}
  wishlist(storeId:string,p:BrowserSession,limit:number,offset:number){return this.scope(storeId,p,async(tx,customerId)=>(await tx.customerWishlist.findMany({where:{customerId,storeId,product:{status:'ACTIVE'}},orderBy:[{createdAt:'desc'},{productId:'asc'}],take:limit+1,skip:offset,select:{productId:true}})).map(row=>row.productId));}
  favorite(storeId:string,p:BrowserSession,productId:string,add:boolean){return this.scope(storeId,p,async(tx,customerId)=>{
    if(!add){await tx.customerWishlist.deleteMany({where:{customerId,storeId,productId}});return;}
    if(!await tx.product.count({where:{id:productId,storeId,status:'ACTIVE'}}))throw new DomainError('NOT_FOUND','Product not found.');
    const prior=await tx.customerWishlist.findUnique({where:{customerId_productId:{customerId,productId}}});if(prior)return;
    if(await tx.customerWishlist.count({where:{customerId,storeId}})>=500)throw new DomainError('CONFLICT','Wishlist limit reached.');
    await tx.customerWishlist.create({data:{customerId,storeId,productId}});
  });}
}
