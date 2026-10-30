import type {PrismaClient,Prisma} from '../../generated/prisma/client.js';
import {DomainError} from '../../domain/commerce.js';
import type {MediaAsset,ProductImage} from '../domain/media.js';
import type {MediaRepositoryPort} from '../application/media.port.js';
export class PrismaMediaRepository implements MediaRepositoryPort {
  constructor(private db:PrismaClient|Prisma.TransactionClient){}
  private transaction<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>){return '$transaction'in this.db?this.db.$transaction(work):work(this.db);}
  async reserve(asset:MediaAsset){const row=await this.db.mediaAsset.create({data:asset});return{...row,status:row.status as MediaAsset['status']};}
  async asset(id:string){const row=await this.db.mediaAsset.findUnique({where:{id}});return row?{...row,status:row.status as MediaAsset['status']}:null;}
  async complete(storeId:string,id:string){
    await this.db.mediaAsset.updateMany({where:{id,storeId,status:'PENDING',expiresAt:{gt:new Date()}},data:{status:'COMPLETE'}});
    const row=await this.db.mediaAsset.findFirst({where:{id,storeId,status:'COMPLETE'}});if(!row)throw new DomainError('CONFLICT','Upload is expired, missing or deleted.');return{...row,status:row.status as MediaAsset['status']};
  }
  async remove(storeId:string,id:string){return this.transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "MediaAsset" WHERE id=${id}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
    const row=await tx.mediaAsset.findFirst({where:{id,storeId}});if(!row)throw new DomainError('NOT_FOUND','Asset not found.');
    if(await tx.productMedia.count({where:{assetId:id,storeId}}))throw new DomainError('CONFLICT','Detach referenced images before deleting an asset.');
    const saved=await tx.mediaAsset.update({where:{id},data:{status:'DELETED'}});return{...saved,status:saved.status as MediaAsset['status']};
  });}
  async setImages(storeId:string,productId:string,images:ProductImage[],version:number){await this.transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
    const product=await tx.product.findFirst({where:{id:productId,storeId}});if(!product)throw new DomainError('NOT_FOUND','Product not found.');
    if(product.version!==version||product.status==='ARCHIVED')throw new DomainError('CONFLICT','Product changed or archived.');
    // Lock asset rows in deterministic order so deletion and attachment serialize.
    for(const id of images.map(i=>i.assetId).sort())await tx.$queryRaw`SELECT id FROM "MediaAsset" WHERE id=${id}::uuid AND "storeId"=${storeId}::uuid FOR UPDATE`;
    if(await tx.mediaAsset.count({where:{id:{in:images.map(i=>i.assetId)},storeId,status:'COMPLETE'}})!==images.length)throw new DomainError('INVALID','All images must be verified assets of this store.');
    await tx.productMedia.deleteMany({where:{storeId,productId}});if(images.length)await tx.productMedia.createMany({data:images.map(image=>({...image,storeId,productId}))});
    await tx.product.update({where:{id:productId},data:{version:{increment:1}}});
  });}
  async links(id:string){return(await this.db.productMedia.findMany({where:{assetId:id},select:{productId:true}})).map(row=>row.productId);}
  async images(productId:string){return this.db.productMedia.findMany({where:{productId,asset:{status:'COMPLETE'}},select:{assetId:true,position:true,altText:true,primary:true},orderBy:[{position:'asc'},{assetId:'asc'}]});}
}
