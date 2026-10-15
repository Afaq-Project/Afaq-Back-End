import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RecommendationsService } from './recommendations.service';
import { ListMatchesDto } from './dto/list-matches.dto';
import {
  MatchListResponseDto,
  MatchWithOpportunityListResponseDto,
} from './dto/match-response.dto';

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('matches')
  @ApiOperation({
    summary: 'List own matches',
    description:
      "Returns the user's match scores. Does not return full opportunity details.",
  })
  @ApiResponse({
    status: 200,
    description: 'List of match scores',
    type: MatchListResponseDto,
  })
  async getMatches(
    @CurrentUser('id') userId: string,
    @Query() dto: ListMatchesDto,
  ): Promise<MatchListResponseDto> {
    return this.recommendationsService.getMatches(userId, dto);
  }

  @Get('matches-with-opportunities')
  @ApiOperation({
    summary: 'List own matches with brief opportunity details',
    description:
      "Returns the user's match scores along with brief opportunity details (combined view).",
  })
  @ApiResponse({
    status: 200,
    description: 'List of match scores and opportunity details',
    type: MatchWithOpportunityListResponseDto,
  })
  async getMatchesWithOpportunities(
    @CurrentUser('id') userId: string,
    @Query() dto: ListMatchesDto,
  ): Promise<MatchWithOpportunityListResponseDto> {
    return this.recommendationsService.getMatchesWithOpportunities(userId, dto);
  }
}
