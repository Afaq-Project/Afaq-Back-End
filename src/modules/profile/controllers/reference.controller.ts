import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReferenceService } from '../services/reference.service';
import { Public } from '../../../common/decorators/public.decorator';
import { GetCountriesDto } from '../dto/get-countries.dto';
import { GetCitiesDto } from '../dto/get-cities.dto';
import { GetLanguagesDto } from '../dto/get-languages.dto';

import { GetMajorCategoriesDto } from '../dto/get-major-categories.dto';
import { GetMajorsDto } from '../dto/get-majors.dto';
import { GetInstitutionsDto } from '../dto/get-institutions.dto';

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
  async getLanguages(@Query() dto: GetLanguagesDto) {
    const result = await this.referenceService.getLanguages(dto);
    return {
      statusCode: 200,
      message: 'Languages retrieved successfully',
      data: result,
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('proficiency-levels')
  @ApiOperation({ summary: 'Get language proficiency levels' })
  @ApiResponse({
    status: 200,
    description: 'Proficiency levels retrieved successfully',
  })
  async getProficiencyLevels() {
    const data = await this.referenceService.getProficiencyLevels();
    return {
      statusCode: 200,
      message: 'Proficiency levels retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
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

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('major-categories')
  @ApiOperation({ summary: 'Get all active major categories' })
  @ApiResponse({
    status: 200,
    description: 'Major categories retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    enum: ['nameEn', 'nameAr'],
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['asc', 'desc'],
  })
  async getMajorCategories(@Query() dto: GetMajorCategoriesDto) {
    const data = await this.referenceService.getMajorCategories(dto);
    return {
      statusCode: 200,
      message: 'Major categories retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('majors')
  @ApiOperation({
    summary: 'Get majors optionally filtered by category and search',
  })
  @ApiResponse({
    status: 200,
    description: 'Majors retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    enum: ['nameEn', 'nameAr'],
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['asc', 'desc'],
  })
  async getMajors(@Query() dto: GetMajorsDto) {
    const data = await this.referenceService.getMajors(dto);
    return {
      statusCode: 200,
      message: 'Majors retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('institutions')
  @ApiOperation({
    summary: 'Get institutions optionally filtered by country, city and search',
  })
  @ApiResponse({
    status: 200,
    description: 'Institutions retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'countryId', required: false, type: String })
  @ApiQuery({ name: 'cityId', required: false, type: String })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    enum: ['nameEn', 'nameAr'],
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    enum: ['asc', 'desc'],
  })
  async getInstitutions(@Query() dto: GetInstitutionsDto) {
    const data = await this.referenceService.getInstitutions(dto);
    return {
      statusCode: 200,
      message: 'Institutions retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('standardized-tests')
  @ApiOperation({ summary: 'Get standardized tests' })
  @ApiResponse({
    status: 200,
    description: 'Standardized tests retrieved successfully',
  })
  async getStandardizedTests() {
    const data = await this.referenceService.getStandardizedTests();
    return {
      statusCode: 200,
      message: 'Standardized tests retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('special-statuses')
  @ApiOperation({ summary: 'Get all active special statuses' })
  @ApiResponse({
    status: 200,
    description: 'Special statuses retrieved successfully',
  })
  async getSpecialStatuses() {
    const data = await this.referenceService.getSpecialStatuses();
    return {
      statusCode: 200,
      message: 'Special statuses retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('document-types')
  @ApiOperation({ summary: 'Get all active document types' })
  @ApiResponse({
    status: 200,
    description: 'Document types retrieved successfully',
  })
  async getDocumentTypes() {
    const data = await this.referenceService.getDocumentTypes();
    return {
      statusCode: 200,
      message: 'Document types retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
