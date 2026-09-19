import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
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

  @Get()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    const data = await this.profileService.getProfileWithDetails(userId);
    return data;
  }

  @Patch()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() data: UpdateProfileDto,
  ) {
    const userId = req.user.id;
    const updatedProfile = await this.profileService.updateProfile(
      userId,
      data,
    );
    return {
      userId: updatedProfile.userId,
      completionPct: updatedProfile.completionPct,
      coreFieldsComplete: updatedProfile.coreFieldsComplete,
      updatedAt: updatedProfile.updatedAt,
    };
  }

  @Post('publish')
  @ApiOperation({ summary: 'Publish user profile' })
  @ApiResponse({ status: 200, description: 'Profile published successfully' })
  @ApiResponse({ status: 409, description: 'Profile already published or core fields incomplete' })
  async publishProfile(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return await this.profileService.publishProfile(userId);
  }
}
