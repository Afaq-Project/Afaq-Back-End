import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { LanguagesService } from '../services/languages.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { UpdateLanguageDto } from '../dto/update-language.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LanguageOwnershipGuard } from '../guards/language-ownership.guard';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('Profile Languages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile/languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Post()
  @ApiOperation({ summary: 'Add a language to profile' })
  @ApiBody({ type: CreateLanguageDto })
  @ApiResponse({ status: 201, description: 'Language added successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Maximum languages allowed reached or bad request.',
  })
  @ApiResponse({
    status: 404,
    description: 'Language or proficiency level not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'Language already added to profile.',
  })
  create(
    @Request() req: AuthRequest,
    @Body() createLanguageDto: CreateLanguageDto,
  ) {
    return this.languagesService.create(req.user.id, createLanguageDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user languages' })
  @ApiResponse({ status: 200, description: 'Return all user languages.' })
  findAll(@Request() req: AuthRequest) {
    return this.languagesService.findAll(req.user.id);
  }

  @Get(':languageId')
  @ApiOperation({ summary: 'Get a user language by ID' })
  @ApiResponse({ status: 200, description: 'Return the user language.' })
  @ApiResponse({ status: 404, description: 'User language not found.' })
  findOne(
    @Request() req: AuthRequest,
    @Param('languageId', ParseUUIDPipe) languageId: string,
  ) {
    return this.languagesService.findOne(req.user.id, languageId);
  }

  @Patch(':languageId')
  @UseGuards(LanguageOwnershipGuard)
  @ApiOperation({ summary: 'Update a user language' })
  @ApiBody({ type: UpdateLanguageDto })
  @ApiResponse({ status: 200, description: 'Language updated successfully.' })
  @ApiResponse({
    status: 404,
    description: 'User language or proficiency level not found.',
  })
  update(
    @Request() req: AuthRequest,
    @Param('languageId', ParseUUIDPipe) languageId: string,
    @Body() updateLanguageDto: UpdateLanguageDto,
  ) {
    return this.languagesService.update(
      req.user.id,
      languageId,
      updateLanguageDto,
    );
  }

  @Delete(':languageId')
  @UseGuards(LanguageOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user language' })
  @ApiResponse({ status: 204, description: 'Language deleted successfully.' })
  @ApiResponse({ status: 404, description: 'User language not found.' })
  async delete(
    @Request() req: AuthRequest,
    @Param('languageId', ParseUUIDPipe) languageId: string,
  ): Promise<void> {
    await this.languagesService.delete(req.user.id, languageId);
  }
}
