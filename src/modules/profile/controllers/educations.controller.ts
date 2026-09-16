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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EducationsService } from '../services/educations.service';
import { CreateEducationDto } from '../dto/create-education.dto';
import { UpdateEducationDto } from '../dto/update-education.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

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
  async create(@Req() req: RequestWithUser, @Body() data: CreateEducationDto) {
    return this.educationsService.create(req.user.id, data);
  }

  @Get()
  @ApiOperation({ summary: 'Get all education records for the current user' })
  async findAll(@Req() req: RequestWithUser) {
    return this.educationsService.findAll(req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an education record' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() data: UpdateEducationDto,
  ) {
    return this.educationsService.update(req.user.id, id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an education record' })
  async remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    await this.educationsService.remove(req.user.id, id);
  }
}
