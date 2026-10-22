// [OMA-W002-T003] NotificationsController
import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve candidate notifications list' })
  @ApiResponse({ status: 200, description: 'Paginated notification records' })
  async getNotifications(
    @Req() req: RequestWithUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findAll(req.user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications badge counter' })
  @ApiResponse({ status: 200, description: 'Total unread count' })
  async getUnreadCount(@Req() req: RequestWithUser) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@Req() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
