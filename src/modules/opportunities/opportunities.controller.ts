import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators';
import { OpportunitiesService } from './opportunities.service';
import { ListOpportunitiesDto } from './dto/list-opportunities.dto';

@ApiTags('Opportunities')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List opportunities' })
  @ApiResponse({
    status: 200,
    description: 'Opportunities retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid Parameter' })
  @ApiResponse({ status: 503, description: 'Service Unavailable' })
  async findMany(@Query() dto: ListOpportunitiesDto) {
    return this.opportunitiesService.findMany(dto);
  }
}
