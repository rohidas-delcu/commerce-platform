import {ManualRefundDto,RefundQueryDto,ProviderRefundDto,SimulateRefundDto} from '../../refunds/http/refunds.dto.js';
import {CreateCouponDto,UpdateCouponDto,CouponQueryDto} from '../../pricing/http/coupons.dto.js';
import {OrderQueryDto,OrderCommandDto,DispatchDto,CollectCodDto,CancelOrderDto,OrderNoteDto} from '../../orders/http/orders.dto.js';
import {PricingDto} from '../../pricing/http/pricing.dto.js';
import {ReservationDto} from '../../inventory/inventory.dto.js';
import {ApiCookieAuth,ApiHeader,ApiOperation,ApiTags} from '@nestjs/swagger';
import {applyDecorators,Body,Controller,Get,Post,Patch,Put,Delete,Headers,Query,Req,Param,ParseUUIDPipe,UseGuards} from '@nestjs/common';
import {MerchantPageDto,NameDto,StoreDto,SettingsDto,VersionDto,RoleDto,InviteDto,AcceptDto,StoreRoleDto,ReserveMediaDto,SetImagesDto} from './merchant.dto.js';
import {IdentityGuard} from '../../identity/http/identity.controller.js';
import type {IdentityRequest} from '../../identity/application/identity.service.js';
import {CreateStoreDto,CreateProductDto,UpdateProductDto,StockAdjustmentDto,ProductQueryDto,VariantMetadataDto,UpdateVariantDto,CreateCollectionDto,UpdateCollectionDto,CollectionVersionDto,CollectionLinkDto,CollectionQueryDto} from '../../http/commerce.dto.js';
import {MerchantService} from '../application/merchant.service.js';
const Mutation = () => applyDecorators(ApiHeader({name:'x-csrf-token',required:true,description:'Token from GET /v1/auth/csrf or the last login/rotation response.'}),ApiHeader({name:'Origin',required:true,description:'An explicitly allowlisted origin.'}));
@ApiTags('Merchant')
@ApiCookieAuth('merchantSession')
@Controller('v1/merchant')
@UseGuards(IdentityGuard)
export class MerchantController {
  constructor(private service:MerchantService){}
  @Mutation()
  @Post('accounts') createAccount(@Req() r:IdentityRequest,@Body() b:NameDto){return this.service.createAccount(r.identitySession!,b.name);}

  @Mutation()
  @Post('accounts/:accountId/suspend') suspendAccount(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string){return this.service.accountStatus(r.identitySession!,id,true);}
  @Mutation()
  @Post('accounts/:accountId/resume') resumeAccount(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string){return this.service.accountStatus(r.identitySession!,id,false);}
  @Mutation()
  @Post('stores/:storeId/suspend') suspendStore(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.storeStatus(r.identitySession!,id,'suspend');}
  @Mutation()
  @Post('stores/:storeId/resume') resumeStore(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.storeStatus(r.identitySession!,id,'resume');}
  @Mutation()
  @Post('stores/:storeId/archive') archiveStore(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.storeStatus(r.identitySession!,id,'archive');}
  @Get('accounts') accounts(@Req() r:IdentityRequest,@Query() page:MerchantPageDto){return this.service.accounts(r.identitySession!,page);}
  @Get('accounts/:accountId/members') members(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Query() page:MerchantPageDto){return this.service.members(r.identitySession!,id,page);}
  @Mutation()
  @Patch('accounts/:accountId/members/:identityId') role(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Param('identityId',ParseUUIDPipe) target:string,@Body() b:RoleDto){return this.service.membership(r.identitySession!,id,target,b.role);}
  @Mutation()
  @Delete('accounts/:accountId/members/:identityId') remove(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Param('identityId',ParseUUIDPipe) target:string){return this.service.membership(r.identitySession!,id,target,null);}

  @Mutation()
  @Post('accounts/:accountId/invitations') invite(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Body() b:InviteDto){return this.service.invite(r.identitySession!,id,b);}
  @Get('accounts/:accountId/invitations') invitations(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Query() page:MerchantPageDto){return this.service.invitations(r.identitySession!,id,page);}
  @Mutation()
  @Delete('accounts/:accountId/invitations/:invitationId') revokeInvitation(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Param('invitationId',ParseUUIDPipe) invitation:string){return this.service.revokeInvitation(r.identitySession!,id,invitation);}
  @Mutation()
  @Post('invitations/accept') accept(@Req() r:IdentityRequest,@Body() b:AcceptDto){return this.service.accept(r.identitySession!,b.token);}
  @Mutation()
  @Patch('stores/:storeId/members/:identityId') storeRole(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('identityId',ParseUUIDPipe) target:string,@Body() b:StoreRoleDto){return this.service.storeMember(r.identitySession!,id,target,b.role);}
  @Mutation()
  @Delete('stores/:storeId/members/:identityId') removeStoreMember(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('identityId',ParseUUIDPipe) target:string){return this.service.storeMember(r.identitySession!,id,target,null);}
  @Mutation()
  @Post('stores') createStore(@Req() r:IdentityRequest,@Body() b:StoreDto,@Headers('idempotency-key') key:string){return this.service.createStore(r.identitySession!,b.merchantId,b,key);}
  @Get('stores') stores(@Req() r:IdentityRequest,@Query() page:MerchantPageDto){return this.service.stores(r.identitySession!,page);}
  @Get('stores/:storeId') store(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.store(r.identitySession!,id);}
  @Mutation()
  @Patch('stores/:storeId/settings') settings(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Body() b:SettingsDto){return this.service.settings(r.identitySession!,id,b);}
  @Mutation()
  @Post('stores/:storeId/onboarding/complete') complete(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Body() b:VersionDto){return this.service.complete(r.identitySession!,id,b.expectedVersion);}
  @Mutation()
  @Post('stores/:storeId/publish') publish(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.publish(r.identitySession!,id,true);}
  @Mutation()
  @Post('stores/:storeId/unpublish') unpublish(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.publish(r.identitySession!,id,false);}
  @Get('stores/:storeId/products') products(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Query() query:ProductQueryDto){return this.service.products(r.identitySession!,id,query);}
  @Mutation()
  @Post('stores/:storeId/products') createProduct(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Body() b:CreateProductDto){return this.service.createProduct(r.identitySession!,id,b);}

  @Get('stores/:storeId/products/:productId') detail(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('productId',ParseUUIDPipe) product:string){return this.service.productDetail(r.identitySession!,id,product);}
  @Mutation()
  @Post('stores/:storeId/products/:productId/deactivate') deactivateProduct(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('productId',ParseUUIDPipe) product:string){return this.service.productState(r.identitySession!,id,product,'DRAFT');}
  @Mutation()
  @Post('stores/:storeId/products/:productId/archive') archiveProduct(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('productId',ParseUUIDPipe) product:string){return this.service.productState(r.identitySession!,id,product,'ARCHIVED');}
  @Mutation()
  @Patch('stores/:storeId/products/:productId') updateProduct(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('productId',ParseUUIDPipe) product:string,@Body() b:UpdateProductDto){return this.service.updateProduct(r.identitySession!,id,product,b);}
  @Mutation()
  @Post('stores/:storeId/products/:productId/activate') activate(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('productId',ParseUUIDPipe) product:string){return this.service.activateProduct(r.identitySession!,id,product);}
  @Mutation()
  @Post('stores/:storeId/variants/:variantId/stock-adjustments') stock(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('variantId',ParseUUIDPipe) variant:string,@Body() b:StockAdjustmentDto){return this.service.stock(r.identitySession!,id,variant,b);}

  @Mutation()
  @Post('stores/:storeId/products/:productId/variants') createVariant(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('productId',ParseUUIDPipe) product:string,@Body() body:VariantMetadataDto){return this.service.createVariant(r.identitySession!,id,product,body);}
  @Mutation()
  @Patch('stores/:storeId/products/:productId/variants/:variantId') updateVariant(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('productId',ParseUUIDPipe) product:string,@Param('variantId',ParseUUIDPipe) variant:string,@Body() body:UpdateVariantDto){return this.service.updateVariant(r.identitySession!,id,product,variant,body);}

  @Mutation()
  @Post('stores/:storeId/collections') createCollection(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Body() body:CreateCollectionDto){return this.service.createCollection(r.identitySession!,id,body);}
  @Get('stores/:storeId/collections') collections(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Query() query:CollectionQueryDto){return this.service.collections(r.identitySession!,id,{...query,featured:query.featured===undefined?undefined:query.featured==='true'});}
  @Get('stores/:storeId/collections/:collectionId/products') collectionProducts(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('collectionId',ParseUUIDPipe) collection:string,@Query() query:ProductQueryDto){return this.service.collectionProducts(r.identitySession!,id,collection,query);}
  @Get('stores/:storeId/collections/:collectionId') collection(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('collectionId',ParseUUIDPipe) collection:string){return this.service.collectionDetail(r.identitySession!,id,collection);}
  @Mutation()
  @Patch('stores/:storeId/collections/:collectionId') updateCollection(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('collectionId',ParseUUIDPipe) collection:string,@Body() body:UpdateCollectionDto){return this.service.updateCollection(r.identitySession!,id,collection,body);}
  @Mutation()
  @Post('stores/:storeId/collections/:collectionId/archive') archiveCollection(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('collectionId',ParseUUIDPipe) collection:string,@Body() body:CollectionVersionDto){return this.service.archiveCollection(r.identitySession!,id,collection,body.expectedVersion);}
  @Mutation()
  @Put('stores/:storeId/collections/:collectionId/products/:productId') linkCollection(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('collectionId',ParseUUIDPipe) collection:string,@Param('productId',ParseUUIDPipe) product:string,@Body() body:CollectionLinkDto){return this.service.linkCollection(r.identitySession!,id,collection,product,body.position,body.expectedVersion);}
  @Mutation()
  @Delete('stores/:storeId/collections/:collectionId/products/:productId') unlinkCollection(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('collectionId',ParseUUIDPipe) collection:string,@Param('productId',ParseUUIDPipe) product:string,@Body() body:CollectionVersionDto){return this.service.linkCollection(r.identitySession!,id,collection,product,null,body.expectedVersion);}

  @Mutation()
  @Post('stores/:storeId/media/reservations') reserveMedia(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Body() body:ReserveMediaDto){return this.service.reserveMedia(r.identitySession!,id,body);}
  @Mutation()
  @Post('stores/:storeId/media/:assetId/complete') completeMedia(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('assetId',ParseUUIDPipe) asset:string){return this.service.completeMedia(r.identitySession!,id,asset);}
  @Mutation()
  @Delete('stores/:storeId/media/:assetId') removeMedia(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('assetId',ParseUUIDPipe) asset:string){return this.service.removeMedia(r.identitySession!,id,asset);}
  @Mutation()
  @Put('stores/:storeId/products/:productId/images') images(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('productId',ParseUUIDPipe) product:string,@Body() body:SetImagesDto){return this.service.setImages(r.identitySession!,id,product,body);}
  @Get('stores/:storeId/inventory-movements') movements(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.movements(r.identitySession!,id);}

  @Mutation()
  @Post('stores/:storeId/inventory/reservations') reserveInventory(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Body() body:ReservationDto){return this.service.reserveInventory(r.identitySession!,id,body);}
  @Get('stores/:storeId/inventory/reservations/:reservationId') reservation(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('reservationId',ParseUUIDPipe) reservation:string){return this.service.inventoryReservation(r.identitySession!,id,reservation);}
  @Mutation()
  @Post('stores/:storeId/inventory/reservations/:reservationId/release') releaseInventory(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('reservationId',ParseUUIDPipe) reservation:string){return this.service.releaseInventory(r.identitySession!,id,reservation);}
  @Mutation()
  @Post('stores/:storeId/inventory/expire-reservations') expireInventory(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.expireInventory(r.identitySession!,id);}

  @Get('stores/:storeId/pricing') pricing(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.pricing(r.identitySession!,id);}
  @Mutation()
  @Put('stores/:storeId/pricing') savePricing(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Body() b:PricingDto){return this.service.savePricing(r.identitySession!,id,b);}
  @Get('stores/:storeId/orders') orders(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Query() q:OrderQueryDto){return this.service.orders(r.identitySession!,id,q);}
  @Get('stores/:storeId/orders/:orderId') order(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string){return this.service.order(r.identitySession!,id,order);}

  @Mutation()
  @Post('stores/:storeId/orders/:orderId/ready') readyOrder(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Body() b:OrderCommandDto){return this.service.orderCommand(r.identitySession!,id,order,{...b,action:{kind:'READY'}});}
  @Mutation()
  @Post('stores/:storeId/orders/:orderId/dispatch') dispatchOrder(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Body() b:DispatchDto){return this.service.orderCommand(r.identitySession!,id,order,{expectedVersion:b.expectedVersion,key:b.key,action:{kind:'DISPATCH',carrier:b.carrier,reference:b.reference}});}
  @Mutation()
  @Post('stores/:storeId/orders/:orderId/deliver') deliverOrder(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Body() b:OrderCommandDto){return this.service.orderCommand(r.identitySession!,id,order,{...b,action:{kind:'DELIVER'}});}
  @Mutation()
  @Post('stores/:storeId/orders/:orderId/collect-cod') collectCod(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Body() b:CollectCodDto){return this.service.orderCommand(r.identitySession!,id,order,{expectedVersion:b.expectedVersion,key:b.key,action:{kind:'COLLECT_COD',amountMinor:b.amountMinor}});}
  @Mutation()
  @Post('stores/:storeId/orders/:orderId/cancel') cancelOrder(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Body() b:CancelOrderDto){return this.service.orderCommand(r.identitySession!,id,order,{expectedVersion:b.expectedVersion,key:b.key,action:{kind:'CANCEL',reason:b.reason}});}
  @Mutation()
  @Post('stores/:storeId/orders/:orderId/notes') noteOrder(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Body() b:OrderNoteDto){return this.service.orderCommand(r.identitySession!,id,order,{expectedVersion:b.expectedVersion,key:b.key,action:{kind:'NOTE',note:b.note}});}

  @Get('stores/:storeId/coupons') coupons(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Query() q:CouponQueryDto){return this.service.coupons(r.identitySession!,id,q);}
  @Get('stores/:storeId/coupons/:couponId') coupon(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('couponId',ParseUUIDPipe) coupon:string){return this.service.coupon(r.identitySession!,id,coupon);}
  @Mutation()
  @Post('stores/:storeId/coupons') createCoupon(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Body() b:CreateCouponDto){return this.service.createCoupon(r.identitySession!,id,b);}
  @Mutation()
  @Patch('stores/:storeId/coupons/:couponId') updateCoupon(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('couponId',ParseUUIDPipe) coupon:string,@Body() b:UpdateCouponDto){return this.service.updateCoupon(r.identitySession!,id,coupon,b);}
  @Mutation()
  @Post('stores/:storeId/coupons/:couponId/archive') archiveCoupon(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('couponId',ParseUUIDPipe) coupon:string,@Body() b:VersionDto){return this.service.updateCoupon(r.identitySession!,id,coupon,{expectedVersion:b.expectedVersion,active:false});}
  @Get('stores/:storeId/orders/:orderId/refunds') refunds(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Query() query:RefundQueryDto){return this.service.refunds(r.identitySession!,id,order,query);}
  @Mutation()
  @Post('stores/:storeId/orders/:orderId/refunds/manual-cod') manualRefund(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Body() b:ManualRefundDto){return this.service.manualRefund(r.identitySession!,id,order,b);}

  @Mutation()
  @Post('stores/:storeId/orders/:orderId/refunds/provider') providerOrderRefund(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('orderId',ParseUUIDPipe) order:string,@Body() body:ProviderRefundDto){return this.service.providerRefund(r.identitySession!,id,'ORDER',order,body);}
  @Mutation()
  @Post('stores/:storeId/payments/:paymentId/refunds') providerPaymentRefund(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('paymentId',ParseUUIDPipe) payment:string,@Body() body:ProviderRefundDto){return this.service.providerRefund(r.identitySession!,id,'PAYMENT',payment,body);}
  @Get('stores/:storeId/refunds/:refundId') refund(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('refundId',ParseUUIDPipe) refund:string){return this.service.refund(r.identitySession!,id,refund);}
  @Mutation()
  @Post('stores/:storeId/refunds/:refundId/reconcile') reconcileRefund(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('refundId',ParseUUIDPipe) refund:string){return this.service.reconcileRefund(r.identitySession!,id,refund);}
  @Mutation()
  @Post('stores/:storeId/refunds/:refundId/simulate') simulateRefund(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('refundId',ParseUUIDPipe) refund:string,@Body() body:SimulateRefundDto){return this.service.reconcileRefund(r.identitySession!,id,refund,body.status);}

  @Get('stores/:storeId/payments') payments(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Query() query:RefundQueryDto){return this.service.payments(r.identitySession!,id,query);}
  @Get('stores/:storeId/payments/:paymentId') payment(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string,@Param('paymentId',ParseUUIDPipe) payment:string){return this.service.payment(r.identitySession!,id,payment);}

}
