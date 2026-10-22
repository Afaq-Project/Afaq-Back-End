// [OMA-W006-T005] Proposal review lifecycle and atomic AST mutation
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiProposalsService } from './ai-proposals.service';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('AI Proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('editor/ai/proposals')
export class AiProposalsController {
  constructor(private readonly proposalsService: AiProposalsService) {}

  @Get('page/:pageId')
  @ApiOperation({ summary: 'List all AI edit proposals for a draft page' })
  @ApiResponse({
    status: 200,
    description: 'List of proposals for the draft page',
  })
  async getProposalsForPage(
    @Req() req: RequestWithUser,
    @Param('pageId', ParseUUIDPipe) pageId: string,
  ) {
    return this.proposalsService.getProposalsForPage(req.user.id, pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':proposalId/accept')
  @ApiOperation({
    summary:
      'Accept an AI edit proposal, creating a version snapshot and applying AST changes',
  })
  @ApiResponse({
    status: 200,
    description: 'Proposal accepted and applied to draft page',
  })
  async acceptProposal(
    @Req() req: RequestWithUser,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
  ) {
    return this.proposalsService.acceptProposal(req.user.id, proposalId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':proposalId/reject')
  @ApiOperation({ summary: 'Reject an AI edit proposal' })
  @ApiResponse({
    status: 200,
    description: 'Proposal rejected',
  })
  async rejectProposal(
    @Req() req: RequestWithUser,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
  ) {
    return this.proposalsService.rejectProposal(req.user.id, proposalId);
  }
}
