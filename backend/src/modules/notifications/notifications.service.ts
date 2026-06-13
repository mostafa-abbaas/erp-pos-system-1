import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private db: DatabaseService) {}

  async getForUser(userId: string, branchId?: string, unreadOnly = false) {
    const conditions = [`(user_id = $1 ${branchId ? `OR branch_id = '${branchId}'` : ''})`];
    if (unreadOnly) conditions.push('is_read = false');
    return this.db.queryMany(
      `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 50`, [userId]
    );
  }

  async unreadCount(userId: string, branchId?: string) {
    const branchFilter = branchId ? `OR branch_id = '${branchId}'` : '';
    const r = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM notifications WHERE (user_id = $1 ${branchFilter}) AND is_read = false`, [userId]
    );
    return r?.count ?? 0;
  }

  async markRead(id: string) {
    return this.db.query(`UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1`, [id]);
  }

  async markAllRead(userId: string, branchId?: string) {
    const branchFilter = branchId ? `OR branch_id = '${branchId}'` : '';
    return this.db.query(
      `UPDATE notifications SET is_read = true, read_at = NOW() WHERE (user_id = $1 ${branchFilter}) AND is_read = false`, [userId]
    );
  }
}
