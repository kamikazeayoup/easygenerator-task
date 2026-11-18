import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('ready')
  async ready() {
    await this.database.checkReady();
    return { status: 'ready' };
  }
}
