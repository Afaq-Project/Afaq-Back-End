import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReferenceService } from '../services/reference.service';
import { Public } from '../../../common/decorators/public.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { GetCountriesDto } from '../dto/get-countries.dto';
import { GetCitiesDto } from '../dto/get-cities.dto';

@ApiTags('profile')
@ApiBearerAuth()
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
  @Get('countries')
  @ApiOperation({ summary: 'Get all active countries' })
  @ApiResponse({
    status: 200,
    description: 'Countries retrieved successfully',
  })
  async getCountries(@Query() dto: GetCountriesDto) {
    const data = await this.referenceService.getCountries(dto);
    return {
      statusCode: 200,
      message: 'Countries retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('cities')
  @ApiOperation({
    summary: 'Get cities optionally filtered by country and search',
  })
  @ApiResponse({
    status: 200,
    description: 'Cities retrieved successfully',
  })
  async getCities(@Query() dto: GetCitiesDto) {
    const data = await this.referenceService.getCities(dto);
    return {
      statusCode: 200,
      message: 'Cities retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('marital-statuses')
  @ApiOperation({ summary: 'Get all active marital statuses' })
  @ApiResponse({
    status: 200,
    description: 'Marital statuses retrieved successfully',
  })
  async getMaritalStatuses() {
    const data = await this.referenceService.getMaritalStatuses();
    return {
      statusCode: 200,
      message: 'Marital statuses retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
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
