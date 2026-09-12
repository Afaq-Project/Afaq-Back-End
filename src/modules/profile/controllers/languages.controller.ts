/* eslint-disable */
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
import { LanguagesService } from '../services/languages.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('profile/languages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile/languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get user languages' })
  async getLanguages(@Request() req: any) {
    const data = await this.languagesService.getLanguages(
      req.user.id as string,
    );
    return {
      statusCode: 200,
      message: 'Languages retrieved',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add a language' })
  async addLanguage(@Request() req: any, @Body() data: CreateLanguageDto) {
    const res = await this.languagesService.addLanguage(
      req.user.id as string,
      data,
    );
    return {
      statusCode: 201,
      message: 'Language added',
      data: res,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':languageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a language' })
  async removeLanguage(
    @Request() req: any,
    @Param('languageId') languageId: string,
  ) {
    await this.languagesService.removeLanguage(
      req.user.id as string,
      languageId,
    );
  }
}
