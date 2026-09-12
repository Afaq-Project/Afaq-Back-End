import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { FieldsOfStudyService } from '../services/fields-of-study.service';
import { CreateFieldOfStudyDto } from '../dto/create-field-of-study.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/* eslint-disable */
@ApiTags('profile/fields-of-study')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile/fields-of-study')
export class FieldsOfStudyController {
  constructor(private readonly fieldsService: FieldsOfStudyService) {}

  @Get()
  @ApiOperation({ summary: 'Get user fields of study' })
  async getFields(@Request() req: any) {
    const data = await this.fieldsService.getFields(req.user.id as string);
    return {
      statusCode: 200,
      message: 'Fields retrieved',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add a field of study' })
  async addField(@Request() req: any, @Body() data: CreateFieldOfStudyDto) {
    const res = await this.fieldsService.addField(req.user.id as string, data);
    return {
      statusCode: 201,
      message: 'Field added',
      data: res,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':fieldId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a field of study' })
  async removeField(@Request() req: any, @Param('fieldId') fieldId: string) {
    await this.fieldsService.removeField(req.user.id as string, fieldId);
  }
}
