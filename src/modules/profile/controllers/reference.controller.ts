import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReferenceService } from '../services/reference.service';
import { Public } from '../../../common/decorators/public.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@ApiTags('profile')
@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('languages')
  @ApiOperation({ summary: 'Get master languages list' })
  @ApiResponse({
    status: 200,
    description: 'Languages retrieved successfully',
  })
  async getLanguages(@Query() dto: PaginationDto) {
    const result = await this.referenceService.getLanguages(dto);
    return {
      statusCode: 200,
      message: 'Languages retrieved successfully',
      data: result,
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('fields-of-study')
  @ApiOperation({ summary: 'Get all fields of study' })
  @ApiResponse({
    status: 200,
    description: 'Fields of study retrieved successfully',
  })
  async getFieldsOfStudy(
    @Query() dto: PaginationDto,
    @Query('category') category?: string,
  ) {
    const params = dto as PaginationDto & { category?: string };
    params.category = category;
    const result = await this.referenceService.getFieldsOfStudy(params);
    return {
      statusCode: 200,
      message: 'Fields of study retrieved successfully',
      data: result,
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('skills-taxonomy')
  @ApiOperation({ summary: 'Get skills taxonomy grouped by category' })
  @ApiResponse({
    status: 200,
    description: 'Skills taxonomy retrieved successfully',
  })
  async getSkillsTaxonomy(
    @Query() dto: PaginationDto,
    @Query('category') category?: string,
  ) {
    const params = dto as PaginationDto & { category?: string };
    params.category = category;
    const result = await this.referenceService.getSkillsTaxonomy(params);
    return {
      statusCode: 200,
      message: 'Skills taxonomy retrieved successfully',
      data: result,
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('education-levels')
  @ApiOperation({ summary: 'Get standardised education levels' })
  @ApiResponse({
    status: 200,
    description: 'Education levels retrieved successfully',
  })
  async getEducationLevels() {
    const data = await this.referenceService.getEducationLevels();
    return {
      statusCode: 200,
      message: 'Education levels retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('app-languages')
  @ApiOperation({ summary: 'Get supported application UI languages' })
  @ApiResponse({
    status: 200,
    description: 'App languages retrieved successfully',
  })
  getAppLanguages() {
    return {
      statusCode: 200,
      message: 'App languages retrieved successfully',
      data: this.referenceService.getAppLanguages(),
      timestamp: new Date().toISOString(),
    };
  }
}
