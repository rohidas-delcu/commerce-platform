import {Controller,Get,Req,Param,ParseUUIDPipe,Query,UseGuards,SetMetadata} from '@nestjs/common';
import {ApiTags,ApiCookieAuth} from '@nestjs/swagger';
import {CustomerGuard} from '../../customer/http/customer.controller.js';
import type {CustomerRequest} from '../../customer/application/customer.service.js';
import {CheckoutService} from '../../checkout/application/checkout.service.js';
import {OrderQueryDto} from './orders.dto.js';
@ApiTags('Customer orders')
@ApiCookieAuth('customerSession')
@SetMetadata('storefrontAccess','account')
@Controller('v1/storefront/:handle/customer/orders')
@UseGuards(CustomerGuard)
export class CustomerOrdersController {
  constructor(private service:CheckoutService){}
  @Get() list(@Req() r:CustomerRequest,@Query() q:OrderQueryDto){return this.service.orders({storeId:r.customerScope!.storeId,principal:r.identitySession!},q);}
  @Get(':orderId') get(@Req() r:CustomerRequest,@Param('orderId',ParseUUIDPipe) id:string){return this.service.order({storeId:r.customerScope!.storeId,principal:r.identitySession!},id);}
}
