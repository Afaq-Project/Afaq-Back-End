import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/ai-client';

@Injectable()
export class AiPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AiPrismaService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    this.logger.log('Connecting to AI Prisma database...');
    await this.$connect();
    this.logger.log('Successfully connected to AI Prisma database.');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from AI Prisma database...');
    await this.$disconnect();
    this.logger.log('Successfully disconnected from AI Prisma database.');
  }

  get client(): PrismaClient {
    return this;
  }
}
