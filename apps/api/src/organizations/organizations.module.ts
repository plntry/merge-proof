import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsRepository } from './organizations.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [OrganizationsRepository],
  exports: [OrganizationsRepository],
})
export class OrganizationsModule {}
