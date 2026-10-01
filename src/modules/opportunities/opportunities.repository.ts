import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/ai-client';
import { AiPrismaService } from '../infrastructure/ai-prisma/ai-prisma.service';

@Injectable()
export class OpportunitiesRepository {
  private readonly logger = new Logger(OpportunitiesRepository.name);

  constructor(private readonly aiPrisma: AiPrismaService) {}

  async findMany(args: Prisma.CleanedOpportunityFindManyArgs) {
    try {
      const [total, data] = await Promise.all([
        this.aiPrisma.cleanedOpportunity.count({ where: args.where }),
        this.aiPrisma.cleanedOpportunity.findMany(args),
      ]);
      return { total, data };
    } catch (error) {
      const e = error as Error;
      this.logger.error(
        `AI DB failure [${e.constructor.name}]: ${e.message}`,
        e.stack,
      );
      if (
        e instanceof Prisma.PrismaClientInitializationError ||
        (e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code.startsWith('P1'))
      ) {
        throw new ServiceUnavailableException('SERVICE_UNAVAILABLE');
      }
      throw error;
    }
  }

  async findById(args: Prisma.CleanedOpportunityFindUniqueArgs) {
    try {
      return await this.aiPrisma.cleanedOpportunity.findUnique(args);
    } catch (error) {
      const e = error as Error;
      this.logger.error(
        `AI DB failure [${e.constructor.name}]: ${e.message}`,
        e.stack,
      );
      if (
        e instanceof Prisma.PrismaClientInitializationError ||
        (e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code.startsWith('P1'))
      ) {
        throw new ServiceUnavailableException('SERVICE_UNAVAILABLE');
      }
      throw error;
    }
  }
}
