import {Controller,Post,Get,Req,Body,Param,ParseUUIDPipe,Headers,UseGuards,SetMetadata} from '@nestjs/common';
import {ApiTags,ApiCookieAuth,ApiHeader} from '@nestjs/swagger';
import {CustomerGuard} from '../../customer/http/customer.controller.js';
import type {CustomerRequest} from '../../customer/application/customer.service.js';
import {PaymentService} from '../application/payments.service.js';
import {StartPaymentDto,SimulatePaymentDto} from './payments.dto.js';
@ApiTags('Store payments — development simulator')
@ApiCookieAuth('customerSession')
@ApiHeader({name:'x-csrf-token',description:'Required for mutations with a verified store customer session.'})
@SetMetadata('storefrontAccess','account')
@Controller('v1/storefront/:handle/customer')
@UseGuards(CustomerGuard)
export class PaymentsController {
 constructor(private service:PaymentService){}
 private context(r:CustomerRequest){return{storeId:r.customerScope!.storeId,principal:r.identitySession!};}
 @SetMetadata('storefrontAccess','commerce')
 @Post('checkouts/:checkoutId/payments') start(@Req() r:CustomerRequest,@Param('checkoutId',ParseUUIDPipe) id:string,@Body() b:StartPaymentDto,@Headers('idempotency-key') key:string){return this.service.start(this.context(r),id,b.expectedVersion,key,b.scenario,b.delaySeconds);}
 @Get('payments/:paymentId') get(@Req() r:CustomerRequest,@Param('paymentId',ParseUUIDPipe) id:string){return this.service.get(this.context(r),id);}
 @Post('payments/:paymentId/reconcile') reconcile(@Req() r:CustomerRequest,@Param('paymentId',ParseUUIDPipe) id:string){return this.service.reconcile(this.context(r),id);}
 @Post('payments/:paymentId/simulate') simulate(@Req() r:CustomerRequest,@Param('paymentId',ParseUUIDPipe) id:string,@Body() b:SimulatePaymentDto){return this.service.simulate(this.context(r),id,b.key,b.event);}
}
