import { Module } from '@nestjs/common';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { RecommendationsRepository } from './recommendations.repository';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [OpportunitiesModule],
  providers: [RecommendationsRepository, RecommendationsService],
  controllers: [RecommendationsController],
  exports: [RecommendationsRepository, RecommendationsService],
})
export class RecommendationsModule {}
