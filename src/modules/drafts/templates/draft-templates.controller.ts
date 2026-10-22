// [OMA-W002-T005] DraftTemplatesController
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DraftTemplatesService } from './draft-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';

interface RequestWithUser {
  user: { id: string; role?: string };
}

@ApiTags('Draft Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drafts/templates')
export class DraftTemplatesController {
  constructor(private readonly templatesService: DraftTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List available templates' })
  @ApiResponse({ status: 200, description: 'List of templates' })
  async findAll(
    @Req() req: RequestWithUser,
    @Query('category') category?: string,
  ) {
    return this.templatesService.findAll(req.user.id, category);
  }

  // [OMA-W002-T005] Pass user id to prevent IDOR access
  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiResponse({ status: 200, description: 'Template details' })
  async findOne(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.findById(id, req.user?.id);
  }

  // [OMA-W002-T005] Pass user role to prevent unauthorized default template creation
  @Post()
  @ApiOperation({ summary: 'Create custom draft template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(req.user.id, dto, req.user?.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete custom draft template' })
  @ApiResponse({ status: 200, description: 'Template deleted' })
  async delete(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.delete(req.user.id, id);
  }
}
