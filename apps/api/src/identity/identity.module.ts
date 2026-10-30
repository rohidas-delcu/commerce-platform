import * as secrets from './infrastructure/secrets.js';
import { Module } from '@nestjs/common';
import { IdentityService } from './application/identity.service.js';
import { FirstPartyIdentityAuthority } from './infrastructure/credentials.js';
import { PrismaIdentityRepository } from './infrastructure/prisma-identity.repository.js';
import { IdentityController, IdentityGuard } from './http/identity.controller.js';
@Module({exports: [IdentityService, IdentityGuard], controllers: [IdentityController], providers: [
  IdentityGuard,
  {provide: PrismaIdentityRepository, useFactory: () => new PrismaIdentityRepository()},
  {provide: IdentityService, useFactory: (repository: PrismaIdentityRepository) => new IdentityService(repository, new FirstPartyIdentityAuthority(), secrets), inject: [PrismaIdentityRepository]}
]})
export class IdentityModule {}
