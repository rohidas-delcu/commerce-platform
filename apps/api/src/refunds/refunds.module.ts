import {Module} from '@nestjs/common';
import {RefundService} from './application/refunds.service.js';
import {PrismaRefundProcessingRepository} from './infrastructure/prisma-refund-processing.repository.js';
import {DevelopmentRefundSimulator} from './infrastructure/development-refunds.js';
@Module({exports:[RefundService],providers:[
 {provide:PrismaRefundProcessingRepository,useFactory:()=>new PrismaRefundProcessingRepository()},
 {provide:DevelopmentRefundSimulator,useFactory:()=>new DevelopmentRefundSimulator()},
 {provide:RefundService,useFactory:(repository:PrismaRefundProcessingRepository,provider:DevelopmentRefundSimulator)=>new RefundService(repository,provider,provider),inject:[PrismaRefundProcessingRepository,DevelopmentRefundSimulator]}
]})
export class RefundModule{}
