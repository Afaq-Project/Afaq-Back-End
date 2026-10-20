// [OMA-W002-T004] DraftPagesController
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
import { DraftPagesService } from './draft-pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('Draft Pages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drafts/spaces/:slug/pages')
export class DraftPagesController {
  constructor(private readonly pagesService: DraftPagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new draft page inside workspace' })
  @ApiResponse({ status: 201, description: 'Draft page created' })
  async create(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Body() dto: CreatePageDto,
  ) {
    return this.pagesService.create(req.user.id, slug, dto);
  }

  @Get(':pageId')
  @ApiOperation({ summary: 'Get full draft page including TipTap contentJson' })
  @ApiResponse({ status: 200, description: 'Draft page loaded' })
  async findOne(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.pagesService.findBySpaceAndId(req.user.id, slug, pageId);
  }

  @Patch(':pageId')
  @ApiOperation({ summary: 'REST Auto-Save endpoint for draft updates' })
  @ApiResponse({
    status: 200,
    description: 'Auto-save acknowledged and snapshot persisted',
  })
  // [OMA-W002-T005] 409 Conflict per OpenAPI spec
  @ApiResponse({
    status: 409,
    description: 'Draft is locked in FINALIZED state; unlock required to edit',
  })
  async update(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pagesService.update(req.user.id, slug, pageId, dto);
  }

  @Delete(':pageId')
  @ApiOperation({ summary: 'Soft-delete draft page to trash' })
  @ApiResponse({ status: 200, description: 'Page moved to trash' })
  async softDelete(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.pagesService.softDelete(req.user.id, slug, pageId);
  }
}
