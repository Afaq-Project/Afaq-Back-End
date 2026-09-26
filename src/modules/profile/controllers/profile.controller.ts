import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfileService } from '../services/profile.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    const profile = await this.profileService.getProfile(userId);
    return profile;
  }

  @Patch('personal')
  @ApiOperation({ summary: 'Update personal profile information' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() data: UpdateProfileDto,
  ) {
    const userId = req.user.id;
    const updatedProfile = await this.profileService.updateProfile(
      userId,
      data,
    );
    return updatedProfile;
  }
}
