import {ApiCookieAuth,ApiHeader,ApiOperation,ApiTags} from '@nestjs/swagger';
import {applyDecorators,Body,Controller,Get,Post,Patch,Delete,Headers,Query,Req,Param,ParseUUIDPipe,UseGuards} from '@nestjs/common';
import {NameDto,StoreDto,SettingsDto,VersionDto,RoleDto,InviteDto,AcceptDto,StoreRoleDto} from './merchant.dto.js';
import {IdentityGuard} from '../../identity/http/identity.controller.js';
import type {IdentityRequest} from '../../identity/application/identity.service.js';
import {CreateStoreDto,CreateProductDto,UpdateProductDto,StockAdjustmentDto,ProductQueryDto,VariantMetadataDto,UpdateVariantDto} from '../../http/commerce.dto.js';
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
  @Get('accounts') accounts(@Req() r:IdentityRequest){return this.service.accounts(r.identitySession!);}
  @Get('accounts/:accountId/members') members(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string){return this.service.members(r.identitySession!,id);}
  @Mutation()
  @Patch('accounts/:accountId/members/:identityId') role(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Param('identityId',ParseUUIDPipe) target:string,@Body() b:RoleDto){return this.service.membership(r.identitySession!,id,target,b.role);}
  @Mutation()
  @Delete('accounts/:accountId/members/:identityId') remove(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Param('identityId',ParseUUIDPipe) target:string){return this.service.membership(r.identitySession!,id,target,null);}

  @Mutation()
  @Post('accounts/:accountId/invitations') invite(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string,@Body() b:InviteDto){return this.service.invite(r.identitySession!,id,b);}
  @Get('accounts/:accountId/invitations') invitations(@Req() r:IdentityRequest,@Param('accountId',ParseUUIDPipe) id:string){return this.service.invitations(r.identitySession!,id);}
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
  @Get('stores') stores(@Req() r:IdentityRequest){return this.service.stores(r.identitySession!);}
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
  @Get('stores/:storeId/inventory-movements') movements(@Req() r:IdentityRequest,@Param('storeId',ParseUUIDPipe) id:string){return this.service.movements(r.identitySession!,id);}
}
