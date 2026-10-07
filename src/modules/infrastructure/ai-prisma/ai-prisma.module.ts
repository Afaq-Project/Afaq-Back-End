import { Global, Module } from '@nestjs/common';
import { AiPrismaService } from './ai-prisma.service';

@Global()
@Module({
  providers: [AiPrismaService],
  exports: [AiPrismaService],
})
export class AiPrismaModule {}
