import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PreferenceOwnershipGuard } from '../guards/preference-ownership.guard';
import { PreferencesService } from '../services/preferences.service';
import { AddDegreeDto } from '../dto/add-degree.dto';
import { AddMajorDto } from '../dto/add-major.dto';
import { AddInstitutionDto } from '../dto/add-institution.dto';

interface RequestWithUser {
  user: { id: string };
}

@Controller('profile/preferences')
@UseGuards(JwtAuthGuard, PreferenceOwnershipGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  async getPreferences(@Req() req: RequestWithUser) {
    return this.preferencesService.getAll(req.user.id);
  }

  @Post('degrees')
  @HttpCode(HttpStatus.OK)
  async addDegree(@Req() req: RequestWithUser, @Body() dto: AddDegreeDto) {
    await this.preferencesService.addDegree(req.user.id, dto.educationLevelId);
  }

  @Delete('degrees/:educationLevelId')
  @HttpCode(204)
  async removeDegree(
    @Req() req: RequestWithUser,
    @Param('educationLevelId', ParseUUIDPipe) educationLevelId: string,
  ) {
    await this.preferencesService.removeDegree(req.user.id, educationLevelId);
  }

  @Post('majors')
  @HttpCode(HttpStatus.OK)
  async addMajor(@Req() req: RequestWithUser, @Body() dto: AddMajorDto) {
    await this.preferencesService.addMajor(req.user.id, dto.majorId);
  }

  @Delete('majors/:majorId')
  @HttpCode(204)
  async removeMajor(
    @Req() req: RequestWithUser,
    @Param('majorId', ParseUUIDPipe) majorId: string,
  ) {
    await this.preferencesService.removeMajor(req.user.id, majorId);
  }

  @Post('institutions')
  @HttpCode(HttpStatus.OK)
  async addInstitution(
    @Req() req: RequestWithUser,
    @Body() dto: AddInstitutionDto,
  ) {
    await this.preferencesService.addInstitution(
      req.user.id,
      dto.institutionId,
    );
  }

  @Delete('institutions/:institutionId')
  @HttpCode(204)
  async removeInstitution(
    @Req() req: RequestWithUser,
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
  ) {
    await this.preferencesService.removeInstitution(req.user.id, institutionId);
  }
}
