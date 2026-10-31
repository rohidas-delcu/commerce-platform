import {PlaceCodDto} from '../../orders/http/orders.dto.js';
import {Controller,Post,Get,Patch,Req,Param,ParseUUIDPipe,Body,Headers,UseGuards} from '@nestjs/common';
import {ApiTags,ApiCookieAuth,ApiHeader} from '@nestjs/swagger';
import {CustomerGuard} from '../../customer/http/customer.controller.js';
import type {CustomerRequest} from '../../customer/application/customer.service.js';
import {CheckoutService} from '../application/checkout.service.js';
import {StartCheckoutDto,CheckoutVersionDto,CheckoutSettingsDto} from './checkout.dto.js';
@ApiTags('Store checkout')
@ApiCookieAuth('customerSession')
@ApiHeader({name:'x-csrf-token',description:'Required for mutations with a verified store customer session.'})
@Controller('v1/storefront/:handle/customer/checkouts')
@UseGuards(CustomerGuard)
export class CheckoutController {
  constructor(private service:CheckoutService){}
  private context(r:CustomerRequest){return{storeId:r.customerScope!.storeId,principal:r.identitySession!};}
  @Post() start(@Req() r:CustomerRequest,@Body() b:StartCheckoutDto,@Headers('idempotency-key') key:string){return this.service.start(this.context(r),b,key);}
  @Get(':checkoutId') get(@Req() r:CustomerRequest,@Param('checkoutId',ParseUUIDPipe) id:string){return this.service.get(this.context(r),id);}
  @Patch(':checkoutId') configure(@Req() r:CustomerRequest,@Param('checkoutId',ParseUUIDPipe) id:string,@Body() b:CheckoutSettingsDto){return this.service.configure(this.context(r),id,b);}
  @Post(':checkoutId/reserve') reserve(@Req() r:CustomerRequest,@Param('checkoutId',ParseUUIDPipe) id:string,@Body() b:CheckoutVersionDto){return this.service.reserve(this.context(r),id,b.expectedVersion);}
  @Post(':checkoutId/cancel') cancel(@Req() r:CustomerRequest,@Param('checkoutId',ParseUUIDPipe) id:string,@Body() b:CheckoutVersionDto){return this.service.cancel(this.context(r),id,b.expectedVersion);}
  @Post(':checkoutId/place') place(@Req() r:CustomerRequest,@Param('checkoutId',ParseUUIDPipe) id:string,@Body() b:PlaceCodDto,@Headers('idempotency-key') key:string){return this.service.placeCod(this.context(r),id,b.expectedVersion,key);}
}
