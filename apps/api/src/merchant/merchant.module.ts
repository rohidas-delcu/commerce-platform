import {RefundModule} from '../refunds/refunds.module.js';
import {RefundService} from '../refunds/application/refunds.service.js';
import {StorageModule} from '../media/storage.module.js';
import {OBJECT_STORAGE,type ObjectStoragePort} from '../media/application/media.port.js';
import * as secrets from '../identity/infrastructure/secrets.js';
import {Module} from '@nestjs/common';
import {IdentityModule} from '../identity/identity.module.js';
import {MerchantService} from './application/merchant.service.js';
import {PrismaMerchantRepository} from './infrastructure/prisma-merchant.repository.js';
import {MerchantController} from './http/merchant.controller.js';
@Module({exports:[MerchantService],imports:[IdentityModule,StorageModule,RefundModule],controllers:[MerchantController],providers:[
  {provide:PrismaMerchantRepository,useFactory:()=>new PrismaMerchantRepository()},
  {provide:MerchantService,useFactory:(repo:PrismaMerchantRepository,storage:ObjectStoragePort,refunds:RefundService)=>new MerchantService(repo,secrets,storage,refunds),inject:[PrismaMerchantRepository,OBJECT_STORAGE,RefundService]}
]})
export class MerchantModule{}
