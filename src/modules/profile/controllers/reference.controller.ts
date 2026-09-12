import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReferenceService } from '../services/reference.service';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('profile')
@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Public()
  @Get('fields-of-study')
  @ApiOperation({ summary: 'Get all fields of study' })
  @ApiResponse({
    status: 200,
    description: 'Fields of study retrieved successfully',
  })
  async getFieldsOfStudy() {
    const data = await this.referenceService.getFieldsOfStudy();
    return {
      statusCode: 200,
      message: 'Fields of study retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('skills-taxonomy')
  @ApiOperation({ summary: 'Get skills taxonomy grouped by category' })
  @ApiResponse({
    status: 200,
    description: 'Skills taxonomy retrieved successfully',
  })
  async getSkillsTaxonomy() {
    const data = await this.referenceService.getSkillsTaxonomy();
    return {
      statusCode: 200,
      message: 'Skills taxonomy retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('languages')
  @ApiOperation({ summary: 'Get all available languages' })
  @ApiResponse({
    status: 200,
    description: 'Languages retrieved successfully',
  })
  async getLanguages() {
    const data = await this.referenceService.getLanguages();
    return {
      statusCode: 200,
      message: 'Languages retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
