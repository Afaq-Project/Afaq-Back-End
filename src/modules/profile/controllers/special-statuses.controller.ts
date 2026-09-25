import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SpecialStatusesService } from '../services/special-statuses.service';
import { CreateSpecialStatusDto } from '../dto/create-special-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SpecialStatusOwnershipGuard } from '../guards/special-status-ownership.guard';

interface RequestWithUser {
  user: { id: string };
}

@UseGuards(JwtAuthGuard, SpecialStatusOwnershipGuard)
@Controller('profile/special-statuses')
export class SpecialStatusesController {
  constructor(
    private readonly specialStatusesService: SpecialStatusesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  add(@Req() req: RequestWithUser, @Body() dto: CreateSpecialStatusDto) {
    return this.specialStatusesService.add(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.specialStatusesService.findAll(req.user.id);
  }

  @Delete(':specialStatusId')
  @HttpCode(204)
  remove(
    @Req() req: RequestWithUser,
    @Param('specialStatusId') specialStatusId: string,
  ) {
    return this.specialStatusesService.remove(req.user.id, specialStatusId);
  }
}
