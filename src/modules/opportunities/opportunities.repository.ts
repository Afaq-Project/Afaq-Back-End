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
        this.aiPrisma.client.cleanedOpportunity.count({ where: args.where }),
        this.aiPrisma.client.cleanedOpportunity.findMany(args),
      ]);
      return { total, data };
    } catch (error) {
      this.logger.error('Error fetching opportunities from AI DB', error);
      // Catch Prisma connection errors or any other unhandled errors as Service Unavailable
      throw new ServiceUnavailableException('SERVICE_UNAVAILABLE');
    }
  }
}
