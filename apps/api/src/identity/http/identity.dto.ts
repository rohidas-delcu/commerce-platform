import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class EmailDto { @IsEmail() @MaxLength(254) email!: string; }
export class LoginDto extends EmailDto { @IsString() @MinLength(1) @MaxLength(128) password!: string; }
export class SignupDto extends EmailDto { @IsString() @MinLength(15) @MaxLength(128) password!: string; @IsString() @MinLength(1) @MaxLength(100) name!: string; }
export class TokenDto { @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string; }
export class ResetDto extends TokenDto { @IsString() @MinLength(15) @MaxLength(128) password!: string; }
export class NameDto { @IsString() @Matches(/\S/) @MaxLength(100) name!: string; }
export class PasswordDto { @IsString() @MaxLength(128) currentPassword!: string; @IsString() @MinLength(15) @MaxLength(128) password!: string; }
