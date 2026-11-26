import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service.js';
import { DATABASE_POOL } from './database/database.constants.js';
import type { Pool } from 'pg';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(DATABASE_POOL) private readonly pool: Pool,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async health() {
    await this.pool.query('SELECT 1');
    return { status: 'ok' };
  }
}
