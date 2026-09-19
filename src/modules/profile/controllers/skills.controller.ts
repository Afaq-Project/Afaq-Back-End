import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SkillsService } from '../services/skills.service';
import { CreateSkillDto } from '../dto/create-skill.dto';
import { UpdateSkillDto } from '../dto/update-skill.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('profile-skills')
@ApiBearerAuth()
@Controller('profile/skills')
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new skill to user profile' })
  @ApiResponse({ status: 201, description: 'Skill added successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or max skills reached',
  })
  async createSkill(@Req() req: RequestWithUser, @Body() data: CreateSkillDto) {
    return this.skillsService.create(req.user.id, data);
  }

  @Get()
  @ApiOperation({ summary: 'Get all skills for the user' })
  @ApiResponse({ status: 200, description: 'Skills retrieved successfully' })
  async getSkills(@Req() req: RequestWithUser, @Query() dto: PaginationDto) {
    return this.skillsService.findAll(req.user.id, dto);
  }

  @Get(':skillId')
  @ApiOperation({ summary: 'Get a specific skill for the user' })
  @ApiParam({ name: 'skillId', description: 'UUID of the skill' })
  @ApiResponse({ status: 200, description: 'Skill retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async getSkill(
    @Req() req: RequestWithUser,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ) {
    return this.skillsService.findOne(req.user.id, skillId);
  }

  @Patch(':skillId')
  @ApiOperation({ summary: 'Update an existing skill' })
  @ApiParam({ name: 'skillId', description: 'UUID of the skill' })
  @ApiResponse({ status: 200, description: 'Skill updated successfully' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async updateSkill(
    @Req() req: RequestWithUser,
    @Param('skillId', ParseUUIDPipe) skillId: string,
    @Body() data: UpdateSkillDto,
  ) {
    return this.skillsService.update(req.user.id, skillId, data);
  }

  @Delete(':skillId')
  @ApiOperation({ summary: 'Remove a skill from user profile' })
  @ApiParam({ name: 'skillId', description: 'UUID of the skill' })
  @ApiResponse({ status: 200, description: 'Skill removed successfully' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async removeSkill(
    @Req() req: RequestWithUser,
    @Param('skillId', ParseUUIDPipe) skillId: string,
  ) {
    return this.skillsService.remove(req.user.id, skillId);
  }
}
