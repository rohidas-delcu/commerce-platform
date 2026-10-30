import {Controller,Get,Post,Patch,Put,Delete,Body,Param,ParseUUIDPipe,Query,Req,Res,UseGuards,SetMetadata,Injectable,type CanActivate,type ExecutionContext} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {ApiTags,ApiCookieAuth,ApiHeader} from '@nestjs/swagger';
import {CustomerService,type CustomerRequest} from '../application/customer.service.js';
import {sessionCookie,type CookieResponse} from '../../identity/http/session-cookie.js';
import {SignupDto,EmailDto,TokenDto,LoginDto,ResetDto,NameDto,PasswordDto} from '../../identity/http/identity.dto.js';
import {AddressDto,UpdateAddressDto,AddressVersionDto,CustomerPageDto} from './customer.dto.js';
const Access=(mode:string)=>SetMetadata('customerAccess',mode);
@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private service:CustomerService,private reflector:Reflector){}
  async canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest<CustomerRequest&{method:string}>();
    context.switchToHttp().getResponse<CookieResponse>().setHeader('Cache-Control','no-store');
    const scope=await this.service.scope(request.params.handle);request.customerScope=scope;
    const mode=this.reflector.get<string>('customerAccess',context.getHandler())??'member';
    if(mode!=='bootstrap')await scope.auth.context(request,mode!=='public',request.method!=='GET',mode==='refresh');return true;
  }
}
@ApiTags('Store customer')
@ApiCookieAuth('customerSession')
@ApiHeader({name:'x-csrf-token',description:'Required for mutations; obtain via this store customer auth/csrf endpoint.'})
@ApiHeader({name:'Origin',description:'Required approved origin for mutations and bootstrap.'})
@Controller('v1/storefront/:handle/customer')
@UseGuards(CustomerGuard)
export class CustomerController {
  constructor(private service:CustomerService){}
  @Get('auth/csrf') @Access('bootstrap')
  async csrf(@Req() r:CustomerRequest,@Res({passthrough:true}) response:CookieResponse){const scope=r.customerScope!,tokens=await scope.auth.bootstrap(r);return sessionCookie(response,tokens.value,tokens.csrf,false,scope.baseCookieName);}
  @Post('auth/signup') @Access('public') signup(@Req() r:CustomerRequest,@Body() b:SignupDto){return r.customerScope!.auth.register(b.email,b.password,b.name);}
  @Post('auth/verification/resend') @Access('public') resend(@Req() r:CustomerRequest,@Body() b:EmailDto){return r.customerScope!.auth.challenge(b.email,'VERIFY');}
  @Post('auth/verification/confirm') @Access('public') async verify(@Req() r:CustomerRequest,@Body() b:TokenDto){await r.customerScope!.auth.consume(b.token,'VERIFY');return{status:'ok'};}
  @Post('auth/password/forgot') @Access('public') forgot(@Req() r:CustomerRequest,@Body() b:EmailDto){return r.customerScope!.auth.challenge(b.email,'RESET');}
  @Post('auth/password/reset') @Access('public') async reset(@Req() r:CustomerRequest,@Body() b:ResetDto){await r.customerScope!.auth.consume(b.token,'RESET',b.password);return{status:'ok'};}
  @Post('auth/login') @Access('public') async login(@Req() r:CustomerRequest,@Body() b:LoginDto,@Res({passthrough:true}) response:CookieResponse){const s=r.customerScope!,tokens=await s.auth.login(b.email,b.password,r.identitySession!);return sessionCookie(response,tokens.value,tokens.csrf,false,s.baseCookieName);}
  @Post('auth/refresh') @Access('refresh') async refresh(@Req() r:CustomerRequest,@Res({passthrough:true}) response:CookieResponse){const s=r.customerScope!,tokens=await s.auth.refresh(r);return sessionCookie(response,tokens.value,tokens.csrf,false,s.baseCookieName);}
  @Post('auth/logout') async logout(@Req() r:CustomerRequest,@Res({passthrough:true}) response:CookieResponse){await r.customerScope!.auth.logout(r.identitySession!);sessionCookie(response,'','',true,r.customerScope!.baseCookieName);return{status:'ok'};}
  @Post('auth/logout-all') async logoutAll(@Req() r:CustomerRequest,@Res({passthrough:true}) response:CookieResponse){await r.customerScope!.auth.logout(r.identitySession!,true);sessionCookie(response,'','',true,r.customerScope!.baseCookieName);return{status:'ok'};}
  @Get('profile') profile(@Req() r:CustomerRequest){return r.identitySession!.profile;}
  @Patch('profile') update(@Req() r:CustomerRequest,@Body() b:NameDto){return r.customerScope!.auth.updateProfile(r.identitySession!,b.name);}
  @Post('auth/password/change') async password(@Req() r:CustomerRequest,@Body() b:PasswordDto){await r.customerScope!.auth.changePassword(r.identitySession!,b.currentPassword,b.password);return{status:'ok'};}
  @Get('auth/sessions') sessions(@Req() r:CustomerRequest){return r.customerScope!.auth.listSessions(r.identitySession!);}
  @Delete('auth/sessions/:sessionId') async revoke(@Req() r:CustomerRequest,@Param('sessionId',ParseUUIDPipe) id:string){await r.customerScope!.auth.revokeSession(r.identitySession!,id);return{status:'ok'};}
  @Get('addresses') addresses(@Req() r:CustomerRequest){return this.service.addresses(r.customerScope!,r.identitySession!);}
  @Post('addresses') address(@Req() r:CustomerRequest,@Body() b:AddressDto){return this.service.saveAddress(r.customerScope!,r.identitySession!,b);}
  @Patch('addresses/:addressId') editAddress(@Req() r:CustomerRequest,@Param('addressId',ParseUUIDPipe) id:string,@Body() b:UpdateAddressDto){return this.service.saveAddress(r.customerScope!,r.identitySession!,b,id,b.expectedVersion);}
  @Delete('addresses/:addressId') removeAddress(@Req() r:CustomerRequest,@Param('addressId',ParseUUIDPipe) id:string,@Body() b:AddressVersionDto){return this.service.removeAddress(r.customerScope!,r.identitySession!,id,b.expectedVersion);}
  @Get('wishlist') wishlist(@Req() r:CustomerRequest,@Query() q:CustomerPageDto){return this.service.wishlist(r.customerScope!,r.identitySession!,q);}
  @Put('wishlist/:productId') favorite(@Req() r:CustomerRequest,@Param('productId',ParseUUIDPipe) id:string){return this.service.favorite(r.customerScope!,r.identitySession!,id,true);}
  @Delete('wishlist/:productId') unfavorite(@Req() r:CustomerRequest,@Param('productId',ParseUUIDPipe) id:string){return this.service.favorite(r.customerScope!,r.identitySession!,id,false);}
}
