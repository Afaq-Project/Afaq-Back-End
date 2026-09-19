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
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { LanguagesService } from '../services/languages.service';
import { CreateLanguageDto } from '../dto/create-language.dto';
import { UpdateLanguageDto } from '../dto/update-language.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
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
  @ApiResponse({ status: 201, description: 'Language added successfully.' })
  create(
    @Request() req: AuthRequest,
    @Body() createLanguageDto: CreateLanguageDto,
  ) {
    return this.languagesService.create(req.user.id, createLanguageDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user languages' })
  @ApiResponse({ status: 200, description: 'Return all user languages.' })
  findAll(@Request() req: AuthRequest, @Query() dto: PaginationDto) {
    return this.languagesService.findAll(req.user.id, dto);
  }

  @Get(':languageId')
  @ApiOperation({ summary: 'Get a user language by ID' })
  @ApiResponse({ status: 200, description: 'Return the user language.' })
  findOne(
    @Request() req: AuthRequest,
    @Param('languageId', ParseUUIDPipe) languageId: string,
  ) {
    return this.languagesService.findOne(req.user.id, languageId);
  }

  @Patch(':languageId')
  @UseGuards(LanguageOwnershipGuard)
  @ApiOperation({ summary: 'Update a user language' })
  @ApiResponse({ status: 200, description: 'Language updated successfully.' })
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
  async remove(
    @Request() req: AuthRequest,
    @Param('languageId', ParseUUIDPipe) languageId: string,
  ): Promise<void> {
    await this.languagesService.remove(req.user.id, languageId);
  }
}
