import * as secrets from '../identity/infrastructure/secrets.js';
import {Module} from '@nestjs/common';
import {IdentityModule} from '../identity/identity.module.js';
import {MerchantService} from './application/merchant.service.js';
import {PrismaMerchantRepository} from './infrastructure/prisma-merchant.repository.js';
import {MerchantController} from './http/merchant.controller.js';
@Module({exports:[MerchantService],imports:[IdentityModule],controllers:[MerchantController],providers:[
  {provide:PrismaMerchantRepository,useFactory:()=>new PrismaMerchantRepository()},
  {provide:MerchantService,useFactory:(repo:PrismaMerchantRepository)=>new MerchantService(repo,secrets),inject:[PrismaMerchantRepository]}
]})
export class MerchantModule{}
