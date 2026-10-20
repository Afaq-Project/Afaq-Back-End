// [OMA-W002-T004] DraftSpacesController
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DraftSpacesService } from './draft-spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('Draft Spaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drafts/spaces')
export class DraftSpacesController {
  constructor(private readonly spacesService: DraftSpacesService) {}

  @Get()
  @ApiOperation({ summary: 'List candidate draft workspaces' })
  @ApiResponse({ status: 200, description: 'List of user workspaces' })
  async findAll(@Req() req: RequestWithUser) {
    return this.spacesService.findAll(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new draft workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateSpaceDto) {
    return this.spacesService.create(req.user.id, dto);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get workspace details and document hierarchy' })
  @ApiResponse({
    status: 200,
    description: 'Workspace details with nested pages',
  })
  async findBySlug(@Req() req: RequestWithUser, @Param('slug') slug: string) {
    return this.spacesService.findBySlug(req.user.id, slug);
  }

  @Patch(':slug')
  @ApiOperation({ summary: 'Update draft workspace metadata' })
  @ApiResponse({ status: 200, description: 'Workspace updated' })
  async update(
    @Req() req: RequestWithUser,
    @Param('slug') slug: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.spacesService.update(req.user.id, slug, dto);
  }

  @Delete(':slug')
  @ApiOperation({ summary: 'Delete draft workspace' })
  @ApiResponse({ status: 200, description: 'Workspace deleted' })
  async delete(@Req() req: RequestWithUser, @Param('slug') slug: string) {
    return this.spacesService.delete(req.user.id, slug);
  }
}
