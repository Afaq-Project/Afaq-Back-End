// [OMA-W002-T009] InvitationsController
import {
  Controller,
  Get,
  Post,
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
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public, Roles } from '../../common/decorators';
import { InvitationsService } from './invitations.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { RegisterWithInviteDto } from './dto/register-with-invite.dto';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('Invitations')
@Controller('auth')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // [OMA-W002-T004] Restrict invitation issuance to system_admin and admin roles
  @Roles('system_admin', 'admin')
  @Post('invitations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Issue an onboarding invitation (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Invitation created with secure invite token link',
  })
  async issueInvitation(
    @Req() req: RequestWithUser,
    @Body() dto: InviteUserDto,
  ) {
    return this.invitationsService.issueInvitation(req.user.id, dto);
  }

  @Public()
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Validate an invitation token before signup' })
  @ApiResponse({ status: 200, description: 'Token is valid and unconsumed' })
  @ApiResponse({
    status: 404,
    description: 'Invalid, consumed, or expired invitation token',
  })
  async validateToken(@Param('token') token: string) {
    return this.invitationsService.validateToken(token);
  }

  @Public()
  @Post('register-with-invite')
  @ApiOperation({
    summary: 'Register account using a validated invitation token',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created and invitation consumed',
  })
  async registerWithInvite(@Body() dto: RegisterWithInviteDto) {
    return this.invitationsService.registerWithInvite(dto);
  }
}
