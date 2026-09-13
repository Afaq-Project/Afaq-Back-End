/* eslint-disable */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SkillsService } from '../services/skills.service';
import { CreateSkillDto } from '../dto/create-skill.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('profile/skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile/skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user skills' })
  async getSkills(@Request() req: any) {
    const data = await this.skillsService.getSkills(req.user.id as string);
    return {
      statusCode: 200,
      message: 'Skills retrieved',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Add a skill' })
  async addSkill(@Request() req: any, @Body() data: CreateSkillDto) {
    const res = await this.skillsService.addSkill(req.user.id as string, data);
    return {
      statusCode: 201,
      message: 'Skill added',
      data: res,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':skillId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a skill' })
  async removeSkill(@Request() req: any, @Param('skillId', ParseUUIDPipe) skillId: string) {
    await this.skillsService.removeSkill(req.user.id as string, skillId);
  }
}
