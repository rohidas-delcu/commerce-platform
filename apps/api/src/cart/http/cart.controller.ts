import {QuoteDto} from '../../pricing/http/pricing.dto.js';
import {Controller,Get,Post,Put,Delete,Body,Param,ParseUUIDPipe,Req,Res,UseGuards,SetMetadata} from '@nestjs/common';
import {ApiTags,ApiCookieAuth,ApiHeader} from '@nestjs/swagger';
import {CustomerGuard} from '../../customer/http/customer.controller.js';
import type {CustomerRequest} from '../../customer/application/customer.service.js';
import {hostCookie,type CookieResponse} from '../../identity/http/session-cookie.js';
import {CartService} from '../application/cart.service.js';
import {CartVersionDto,CartItemDto,CartMergeDto,CartCouponDto} from './cart.dto.js';
@ApiTags('Store carts')
@ApiCookieAuth('customerSession')
@ApiHeader({name:'x-csrf-token',description:'Required for mutations, using the store customer anonymous or authenticated session.'})
@Controller('v1/storefront/:handle/cart')
@UseGuards(CustomerGuard)
@SetMetadata('customerAccess','public')
export class CartController {
  constructor(private service:CartService){}
  private context(r:CustomerRequest){return this.service.context(r.customerScope!.storeId,r.identitySession!,typeof r.headers.cookie==='string'?r.headers.cookie:undefined);}
  @Post() async create(@Req() r:CustomerRequest,@Res({passthrough:true}) response:CookieResponse){const result=await this.service.create(this.context(r));if(result.guestCookie)hostCookie(response,'delcu_cart_'+r.customerScope!.storeId,result.guestCookie,604800);return result.cart;}
  @Get() current(@Req() r:CustomerRequest){return this.service.current(this.context(r));}
  @Put('items/:variantId') set(@Req() r:CustomerRequest,@Param('variantId',ParseUUIDPipe) id:string,@Body() b:CartItemDto){return this.service.update(this.context(r),b.expectedVersion,{type:'set',variantId:id,quantity:b.quantity});}
  @Delete('items/:variantId') remove(@Req() r:CustomerRequest,@Param('variantId',ParseUUIDPipe) id:string,@Body() b:CartVersionDto){return this.service.update(this.context(r),b.expectedVersion,{type:'remove',variantId:id});}
  @Delete('items') clear(@Req() r:CustomerRequest,@Body() b:CartVersionDto){return this.service.update(this.context(r),b.expectedVersion,{type:'clear'});}
  @Post('refresh') refresh(@Req() r:CustomerRequest,@Body() b:CartVersionDto){return this.service.update(this.context(r),b.expectedVersion,{type:'refresh'});}
  @Post('merge') async merge(@Req() r:CustomerRequest,@Body() b:CartMergeDto,@Res({passthrough:true}) response:CookieResponse){const result=await this.service.merge(this.context(r),b.expectedVersion,b.guestVersion);hostCookie(response,'delcu_cart_'+r.customerScope!.storeId,'',0);return result;}
  @Post('quote') quote(@Req() r:CustomerRequest,@Body() b:QuoteDto){return this.service.quote(this.context(r),b);}
  @Post('coupon') coupon(@Req() r:CustomerRequest,@Body() b:CartCouponDto){return this.service.update(this.context(r),b.expectedVersion,{type:'coupon',code:b.code});}
  @Delete('coupon') removeCoupon(@Req() r:CustomerRequest,@Body() b:CartVersionDto){return this.service.update(this.context(r),b.expectedVersion,{type:'coupon',code:null});}
}
