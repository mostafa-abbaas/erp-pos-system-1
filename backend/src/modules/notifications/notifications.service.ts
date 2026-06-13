import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getForUser(userId: string, branchId?: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        OR: [{ userId }, { branchId }],
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, OR: [{ userId }, {}] },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string, branchId?: string) {
    return this.prisma.notification.updateMany({
      where: { OR: [{ userId }, ...(branchId ? [{ branchId }] : [])], isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string, branchId?: string) {
    return this.prisma.notification.count({
      where: { OR: [{ userId }, ...(branchId ? [{ branchId }] : [])], isRead: false },
    });
  }
}
