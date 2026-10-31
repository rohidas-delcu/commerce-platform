import {sessionCookie} from './session-cookie.js';
import {ApiCookieAuth,ApiHeader,ApiOperation,ApiTags} from '@nestjs/swagger';
import {applyDecorators, Body, Controller, Get, Post, Patch, Delete, Param, ParseUUIDPipe, Req, Res, UseGuards, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {EmailDto,LoginDto,SignupDto,TokenDto,ResetDto,NameDto,PasswordDto} from './identity.dto.js';
import { IdentityService, type IdentityRequest } from '../application/identity.service.js';

interface IdentityResponse { setHeader(name: string, value: string | string[]): void }
const Access = (mode: 'bootstrap' | 'public' | 'member' | 'refresh') => SetMetadata('identityAccess', mode);

@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(private service: IdentityService, private reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    context.switchToHttp().getResponse<IdentityResponse>().setHeader('Cache-Control', 'no-store');
    const mode = this.reflector.get<string>('identityAccess', context.getHandler()) ?? 'member';
    if (mode !== 'bootstrap') {
      const request = context.switchToHttp().getRequest<IdentityRequest & {method: string}>();
      await this.service.context(request, mode !== 'public', request.method !== 'GET', mode === 'refresh');
    }
    return true;
  }
}
const Mutation = () => applyDecorators(ApiHeader({name:'x-csrf-token',required:true,description:'Token from GET /v1/auth/csrf or the last login/rotation response.'}),ApiHeader({name:'Origin',required:true,description:'An explicitly allowlisted origin.'}));
@ApiTags('Identity')
@ApiCookieAuth('merchantSession')
@Controller('v1/auth')
@UseGuards(IdentityGuard)
export class IdentityController {
  constructor(private service: IdentityService) {}
  private cookies(response: IdentityResponse, value: string, csrf: string, clear = false) {
    return sessionCookie(response,value,csrf,clear);
  }
  @ApiOperation({security:[],summary:'Bootstrap or retain the browser session and obtain a CSRF token.'})
  @Get('csrf') @Access('bootstrap')
  async csrf(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    const tokens = await this.service.bootstrap(request);
    return this.cookies(response, tokens.value, tokens.csrf);
  }
  @Mutation()
  @Post('signup') @Access('public')
  signup(@Body() body: SignupDto) { return this.service.register(body.email, body.password, body.name); }
  @Mutation()
  @Post('verification/resend') @Access('public')
  resend(@Body() body: EmailDto) { return this.service.challenge(body.email, 'VERIFY'); }
  @Mutation()
  @Post('verification/confirm') @Access('public')
  async verify(@Body() body: TokenDto) { await this.service.consume(body.token, 'VERIFY'); return {status: 'ok'}; }
  @Mutation()
  @Post('password/forgot') @Access('public')
  forgot(@Body() body: EmailDto) { return this.service.challenge(body.email, 'RESET'); }
  @Mutation()
  @Post('password/reset') @Access('public')
  async reset(@Body() body: ResetDto) { await this.service.consume(body.token, 'RESET', body.password); return {status: 'ok'}; }
  @Mutation()
  @Post('login') @Access('public')
  async login(@Req() request: IdentityRequest, @Body() body: LoginDto, @Res({passthrough: true}) response: IdentityResponse) {
    const tokens = await this.service.login(body.email, body.password, request.identitySession!);
    return this.cookies(response, tokens.value, tokens.csrf);
  }
  @Mutation()
  @Post('session/refresh') @Access('refresh')
  async refresh(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    const tokens = await this.service.refresh(request); return this.cookies(response, tokens.value, tokens.csrf);
  }
  @Get('me')
  me(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    response.setHeader('Cache-Control', 'no-store'); return request.identitySession!.profile;
  }
  @Mutation()
  @Patch('me')
  profile(@Req() request: IdentityRequest, @Body() body: NameDto) { return this.service.updateProfile(request.identitySession!, body.name); }
  @Get('sessions')
  sessions(@Req() request: IdentityRequest) { return this.service.listSessions(request.identitySession!); }
  @Mutation()
  @Delete('sessions/:id')
  async revoke(@Req() request: IdentityRequest, @Param('id', ParseUUIDPipe) id: string) {
    await this.service.revokeSession(request.identitySession!, id); return {status: 'ok'};
  }
  @Mutation()
  @Post('logout')
  async logout(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    await this.service.logout(request.identitySession!); return this.cookies(response, '', '', true);
  }
  @Mutation()
  @Post('logout-all')
  async logoutAll(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    await this.service.logout(request.identitySession!, true); return this.cookies(response, '', '', true);
  }
  @Mutation()
  @Post('password/change')
  async password(@Req() request: IdentityRequest, @Body() body: PasswordDto, @Res({passthrough: true}) response: IdentityResponse) {
    await this.service.changePassword(request.identitySession!, body.currentPassword, body.password); return this.cookies(response, '', '', true);
  }
  @Mutation()
  @Post('deactivate')
  deactivate(@Req() request: IdentityRequest) { return this.service.deactivate(request.identitySession!); }
}
