import {Module} from '@nestjs/common';
import {PaymentService} from './application/payments.service.js';
import {PrismaPaymentRepository} from './infrastructure/prisma-payments.repository.js';
import {DevelopmentPaymentSimulator} from './infrastructure/development-payments.js';
@Module({exports:[PaymentService],providers:[
 {provide:PrismaPaymentRepository,useFactory:()=>new PrismaPaymentRepository()},
 {provide:DevelopmentPaymentSimulator,useFactory:()=>new DevelopmentPaymentSimulator()},
 {provide:PaymentService,useFactory:(repository:PrismaPaymentRepository,simulator:DevelopmentPaymentSimulator)=>new PaymentService(repository,simulator,simulator),inject:[PrismaPaymentRepository,DevelopmentPaymentSimulator]}
]})
export class PaymentModule{}
