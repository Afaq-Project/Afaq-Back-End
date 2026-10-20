// [OMA-W002-T007] DraftVersionsController
import {
  Controller,
  Get,
  Post,
  Param,
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
import { DraftVersionsService } from './draft-versions.service';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('Draft Versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drafts/pages/:pageId/versions')
export class DraftVersionsController {
  constructor(private readonly versionsService: DraftVersionsService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve chronological version history' })
  @ApiResponse({ status: 200, description: 'Version timeline list' })
  async listVersions(
    @Req() req: RequestWithUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.versionsService.listVersions(req.user.id, pageId);
  }

  @Post(':versionId/revert')
  // [OMA-W003-T003] Explicit HTTP 200 OK for action route
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revert draft content to a historical version snapshot',
  })
  @ApiResponse({
    status: 200,
    description: 'Active content reverted to selected snapshot',
  })
  async revert(
    @Req() req: RequestWithUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.versionsService.revertToVersion(req.user.id, pageId, versionId);
  }
}
