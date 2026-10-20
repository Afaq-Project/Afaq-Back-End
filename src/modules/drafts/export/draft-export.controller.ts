// [OMA-W002-T008] DraftExportController
import {
  Controller,
  Post,
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
import { DraftExportService } from './draft-export.service';
import { DraftFinalizeDto } from './dto/draft-finalize.dto';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('Draft Finalization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drafts/pages')
export class DraftExportController {
  constructor(private readonly exportService: DraftExportService) {}

  @Post(':pageId/finalize')
  @ApiOperation({
    summary:
      'Finalize draft into an official PDF document and approve in profile',
  })
  @ApiResponse({
    status: 201,
    description:
      'PDF rendered, uploaded to S3, recorded in documents, and activated in profile',
  })
  async finalize(
    @Req() req: RequestWithUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
    @Body() dto: DraftFinalizeDto,
  ) {
    return this.exportService.finalize(req.user.id, pageId, dto);
  }

  @Post(':pageId/unlock')
  // [OMA-W003-T003] Explicit HTTP 200 OK for action route
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock a finalized draft to start a new revision' })
  @ApiResponse({
    status: 200,
    description: 'Draft unlocked and reset to IN_PROGRESS state',
  })
  async unlock(
    @Req() req: RequestWithUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.exportService.unlock(req.user.id, pageId);
  }
}
