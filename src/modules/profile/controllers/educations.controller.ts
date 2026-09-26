import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { EducationsService } from '../services/educations.service';
import { CreateEducationDto } from '../dto/create-education.dto';
import { UpdateEducationDto } from '../dto/update-education.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EducationOwnershipGuard } from '../guards/education-ownership.guard';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('profile/educations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile/educations')
export class EducationsController {
  constructor(private readonly educationsService: EducationsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new education record' })
  @ApiBody({ type: CreateEducationDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(@Req() req: RequestWithUser, @Body() data: CreateEducationDto) {
    return this.educationsService.create(req.user.id, data);
  }

  @Get()
  @ApiOperation({ summary: 'Get all education records for the current user' })
  @ApiResponse({ status: 200, description: 'Success' })
  async findAll(@Req() req: RequestWithUser, @Query() dto: PaginationDto) {
    return this.educationsService.findAll(req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(EducationOwnershipGuard)
  @ApiOperation({ summary: 'Get an education record by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'EDUCATION_NOT_FOUND' })
  async findOne(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.educationsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @UseGuards(EducationOwnershipGuard)
  @ApiOperation({ summary: 'Update an education record' })
  @ApiBody({ type: UpdateEducationDto })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'EDUCATION_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateEducationDto,
  ) {
    return this.educationsService.update(req.user.id, id, data);
  }

  @Delete(':id')
  @UseGuards(EducationOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an education record' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'EDUCATION_NOT_FOUND' })
  async remove(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.educationsService.remove(req.user.id, id);
  }
}
