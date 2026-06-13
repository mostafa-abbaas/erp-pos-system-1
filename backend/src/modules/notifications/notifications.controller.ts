import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get() async list(@CurrentUser() user: any, @Query('unreadOnly') unreadOnly?: any) {
    return { success: true, data: await this.svc.getForUser(user.id, user.branch_id, String(unreadOnly) === 'true') };
  }
  @Get('unread-count') async count(@CurrentUser() user: any) {
    const count = await this.svc.unreadCount(user.id, user.branch_id);
    return { success: true, data: { count } };
  }
  @Patch(':id/read') async read(@Param('id') id: string) {
    await this.svc.markRead(id); return { success: true };
  }
  @Patch('read-all') async readAll(@CurrentUser() user: any) {
    await this.svc.markAllRead(user.id, user.branch_id); return { success: true };
  }
}
