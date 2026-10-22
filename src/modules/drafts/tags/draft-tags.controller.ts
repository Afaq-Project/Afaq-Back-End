// [OMA-W002-T005] DraftTagsController
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DraftTagsService } from './draft-tags.service';
import { CreateTagDto } from './dto/create-tag.dto';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('Draft Tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drafts/spaces/:slug/tags')
export class DraftTagsController {
  constructor(private readonly tagsService: DraftTagsService) {}

  @Get()
  @ApiOperation({ summary: 'List tags in workspace' })
  @ApiResponse({ status: 200, description: 'List of tags' })
  async list(@Req() req: RequestWithUser, @Param('slug') slug: string) {
    return this.tagsService.listTags(req.user.id, slug);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tag in workspace' })
  @ApiResponse({ status: 201, description: 'Tag created' })
  async create(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.tagsService.createTag(req.user.id, slug, dto);
  }

  @Delete(':tagId')
  @ApiOperation({ summary: 'Delete a tag from workspace' })
  @ApiResponse({ status: 200, description: 'Tag deleted' })
  async delete(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.tagsService.deleteTag(req.user.id, slug, tagId);
  }

  @Post(':tagId/pages/:pageId')
  // [OMA-W003-T003] Explicit HTTP 200 OK for action route
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a tag to a draft page' })
  @ApiResponse({ status: 200, description: 'Tag assigned' })
  async assignToPage(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.tagsService.assignTagToPage(req.user.id, slug, pageId, tagId);
  }

  @Delete(':tagId/pages/:pageId')
  @ApiOperation({ summary: 'Remove a tag from a draft page' })
  @ApiResponse({ status: 200, description: 'Tag removed' })
  async removeFromPage(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.tagsService.removeTagFromPage(req.user.id, slug, pageId, tagId);
  }
}
