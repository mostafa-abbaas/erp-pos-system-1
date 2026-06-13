import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async findAll(query: any) {
    const { search, role, branchId, status, page = 1, limit = 20 } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (search) {
      conditions.push(`(u.username ILIKE $${i} OR u.full_name ILIKE $${i} OR u.email ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }
    if (role) { conditions.push(`u.role = $${i}`); params.push(role); i++; }
    if (branchId) { conditions.push(`u.branch_id = $${i}`); params.push(branchId); i++; }
    if (status) { conditions.push(`u.status = $${i}`); params.push(status); i++; }

    const offset = (page - 1) * limit;
    const where = conditions.join(' AND ');

    const [items, countRow] = await Promise.all([
      this.db.queryMany(
        `SELECT u.id, u.username, u.email, u.full_name, u.full_name_ar, u.role, u.status,
                u.branch_id, u.avatar_url, u.last_login_at, u.created_at,
                json_build_object('id',b.id,'code',b.code,'name',b.name) as branch
         FROM users u LEFT JOIN branches b ON u.branch_id = b.id
         WHERE ${where}
         ORDER BY u.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
        [...params, limit, offset]
      ),
      this.db.queryOne<{ count: string }>(`SELECT COUNT(*)::int as count FROM users u WHERE ${where}`, params),
    ]);

    return { items, total: Number(countRow?.count ?? 0), page: +page, limit: +limit, totalPages: Math.ceil(Number(countRow?.count ?? 0) / limit) };
  }

  async findOne(id: string) {
    const user = await this.db.queryOne(
      `SELECT u.id, u.username, u.email, u.full_name, u.full_name_ar, u.role, u.status,
              u.branch_id, u.avatar_url, u.last_login_at, u.created_at, u.updated_at,
              CASE WHEN b.id IS NOT NULL THEN json_build_object('id',b.id,'code',b.code,'name',b.name) ELSE NULL END as branch
       FROM users u LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = $1`, [id]
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: any) {
    const existsUsername = await this.db.queryOne('SELECT id FROM users WHERE username=$1', [dto.username]);
    if (existsUsername) throw new ConflictException(`Username "${dto.username}" already taken`);

    if (dto.email) {
      const existsEmail = await this.db.queryOne('SELECT id FROM users WHERE email=$1', [dto.email]);
      if (existsEmail) throw new ConflictException(`Email "${dto.email}" already registered`);
    }

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.db.queryOne(
      `INSERT INTO users (username, email, password_hash, full_name, full_name_ar, role, branch_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, username, email, full_name, full_name_ar, role, branch_id, status, created_at`,
      [dto.username, dto.email ?? null, passwordHash, dto.fullName, dto.fullNameAr ?? null,
       dto.role ?? 'CASHIER', dto.branchId ?? null, dto.status ?? 'ACTIVE']
    );
  }

  async update(id: string, dto: any) {
    await this.findOne(id);

    if (dto.username) {
      const exists = await this.db.queryOne('SELECT id FROM users WHERE username=$1 AND id!=$2', [dto.username, id]);
      if (exists) throw new ConflictException(`Username "${dto.username}" already taken`);
    }
    if (dto.email) {
      const exists = await this.db.queryOne('SELECT id FROM users WHERE email=$1 AND id!=$2', [dto.email, id]);
      if (exists) throw new ConflictException(`Email "${dto.email}" already registered`);
    }

    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, string> = {
      username: 'username', email: 'email', fullName: 'full_name', fullNameAr: 'full_name_ar',
      role: 'role', branchId: 'branch_id', status: 'status', avatarUrl: 'avatar_url',
    };
    for (const [k, col] of Object.entries(map)) {
      if (dto[k] !== undefined) { fields.push(`${col}=$${i}`); params.push(dto[k]); i++; }
    }
    if (!fields.length) return this.findOne(id);
    params.push(id);
    return this.db.queryOne(
      `UPDATE users SET ${fields.join(',')}, updated_at=NOW() WHERE id=$${i} RETURNING id, username, email, full_name, role, branch_id, status`,
      params
    );
  }

  async resetPassword(id: string, dto: any, requesterId: string, requesterRole: string) {
    await this.findOne(id);

    // Only admin can reset other users' passwords; others need current password
    if (requesterRole !== 'ADMIN' && requesterId !== id) {
      throw new BadRequestException('Only admins can reset other users\' passwords');
    }

    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.db.query(
      'UPDATE users SET password_hash=$1, updated_at=NOW(), failed_attempts=0, locked_until=NULL WHERE id=$2',
      [passwordHash, id]
    );

    // Revoke all refresh tokens to force re-login
    await this.db.query('UPDATE refresh_tokens SET is_revoked=true WHERE user_id=$1', [id]);
    return { message: 'Password reset successfully' };
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.db.queryOne(
      'UPDATE users SET status=\'INACTIVE\', updated_at=NOW() WHERE id=$1 RETURNING id, username, status',
      [id]
    );
  }

  async getBranches() {
    return this.db.queryMany('SELECT id, code, name, name_ar, is_warehouse, is_active FROM branches ORDER BY code');
  }

  async createBranch(dto: any) {
    const exists = await this.db.queryOne('SELECT id FROM branches WHERE code=$1', [dto.code]);
    if (exists) throw new ConflictException(`Branch code "${dto.code}" already exists`);
    return this.db.queryOne(
      `INSERT INTO branches (code, name, name_ar, address, phone, is_warehouse, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
      [dto.code, dto.name, dto.nameAr ?? null, dto.address ?? null, dto.phone ?? null, dto.isWarehouse ?? false]
    );
  }

  async getAuditLogs(query: any) {
    const { userId, entity, page = 1, limit = 50 } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;
    if (userId) { conditions.push(`l.user_id=$${i}`); params.push(userId); i++; }
    if (entity) { conditions.push(`l.entity=$${i}`); params.push(entity); i++; }

    const offset = (page - 1) * limit;
    const where = conditions.join(' AND ');
    const items = await this.db.queryMany(
      `SELECT l.*, json_build_object('id',u.id,'username',u.username,'fullName',u.full_name) as user
       FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id
       WHERE ${where} ORDER BY l.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    );
    const countRow = await this.db.queryOne<{ count: string }>(`SELECT COUNT(*)::int as count FROM audit_logs l WHERE ${where}`, params);
    return { items, total: Number(countRow?.count ?? 0) };
  }
}
