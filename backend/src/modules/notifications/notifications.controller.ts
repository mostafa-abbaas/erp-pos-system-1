import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async getAll(@CurrentUser() user: any, @Query('unreadOnly') unreadOnly?: boolean) {
    const data = await this.notificationsService.getForUser(user.id, user.branchId, unreadOnly);
    return { success: true, data };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUnreadCount(user.id, user.branchId);
    return { success: true, data: { count } };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: any) {
    await this.notificationsService.markRead(id, user.id);
    return { success: true };
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: any) {
    await this.notificationsService.markAllRead(user.id, user.branchId);
    return { success: true };
  }
}
