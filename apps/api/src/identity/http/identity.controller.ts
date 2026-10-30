import { Body, Controller, Get, Post, Patch, Delete, Param, ParseUUIDPipe, Req, Res, UseGuards, Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { IdentityService, type IdentityRequest } from '../application/identity.service.js';

class EmailDto { @IsEmail() @MaxLength(254) email!: string; }
class LoginDto extends EmailDto { @IsString() @MinLength(1) @MaxLength(128) password!: string; }
class SignupDto extends LoginDto { @IsString() @MinLength(1) @MaxLength(100) name!: string; }
class TokenDto { @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string; }
class ResetDto extends TokenDto { @IsString() @MinLength(15) @MaxLength(128) password!: string; }
class NameDto { @IsString() @Matches(/\S/) @MaxLength(100) name!: string; }
class PasswordDto { @IsString() @MaxLength(128) currentPassword!: string; @IsString() @MinLength(15) @MaxLength(128) password!: string; }
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
@Controller('v1/auth')
@UseGuards(IdentityGuard)
export class IdentityController {
  constructor(private service: IdentityService) {}
  private cookies(response: IdentityResponse, value: string, csrf: string, clear = false) {
    const production = process.env.NODE_ENV === 'production';
    const name = production ? '__Host-delcu_session' : 'delcu_session';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Set-Cookie', `${name}=${clear ? '' : value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${clear ? 0 : 1800}${production ? '; Secure' : ''}`);
    return {csrfToken: csrf};
  }
  @Get('csrf') @Access('bootstrap')
  async csrf(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    const tokens = await this.service.bootstrap(request);
    return this.cookies(response, tokens.value, tokens.csrf);
  }
  @Post('signup') @Access('public')
  signup(@Body() body: SignupDto) { return this.service.register(body.email, body.password, body.name); }
  @Post('verification/resend') @Access('public')
  resend(@Body() body: EmailDto) { return this.service.challenge(body.email, 'VERIFY'); }
  @Post('verification/confirm') @Access('public')
  async verify(@Body() body: TokenDto) { await this.service.consume(body.token, 'VERIFY'); return {status: 'ok'}; }
  @Post('password/forgot') @Access('public')
  forgot(@Body() body: EmailDto) { return this.service.challenge(body.email, 'RESET'); }
  @Post('password/reset') @Access('public')
  async reset(@Body() body: ResetDto) { await this.service.consume(body.token, 'RESET', body.password); return {status: 'ok'}; }
  @Post('login') @Access('public')
  async login(@Req() request: IdentityRequest, @Body() body: LoginDto, @Res({passthrough: true}) response: IdentityResponse) {
    const tokens = await this.service.login(body.email, body.password, request.identitySession!);
    return this.cookies(response, tokens.value, tokens.csrf);
  }
  @Post('session/refresh') @Access('refresh')
  async refresh(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    const tokens = await this.service.refresh(request); return this.cookies(response, tokens.value, tokens.csrf);
  }
  @Get('me')
  me(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    response.setHeader('Cache-Control', 'no-store'); return request.identitySession!.profile;
  }
  @Patch('me')
  profile(@Req() request: IdentityRequest, @Body() body: NameDto) { return this.service.updateProfile(request.identitySession!, body.name); }
  @Get('sessions')
  sessions(@Req() request: IdentityRequest) { return this.service.listSessions(request.identitySession!); }
  @Delete('sessions/:id')
  async revoke(@Req() request: IdentityRequest, @Param('id', ParseUUIDPipe) id: string) {
    await this.service.revokeSession(request.identitySession!, id); return {status: 'ok'};
  }
  @Post('logout')
  async logout(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    await this.service.logout(request.identitySession!); return this.cookies(response, '', '', true);
  }
  @Post('logout-all')
  async logoutAll(@Req() request: IdentityRequest, @Res({passthrough: true}) response: IdentityResponse) {
    await this.service.logout(request.identitySession!, true); return this.cookies(response, '', '', true);
  }
  @Post('password/change')
  async password(@Req() request: IdentityRequest, @Body() body: PasswordDto, @Res({passthrough: true}) response: IdentityResponse) {
    await this.service.changePassword(request.identitySession!, body.currentPassword, body.password); return this.cookies(response, '', '', true);
  }
  @Post('deactivate')
  deactivate(@Req() request: IdentityRequest) { return this.service.deactivate(request.identitySession!); }
}
