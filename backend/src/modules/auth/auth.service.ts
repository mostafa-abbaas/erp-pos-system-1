import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  branchId: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private db: DatabaseService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.db.queryOne('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status === 'SUSPENDED') throw new UnauthorizedException('Account suspended');
    if (user.status === 'INACTIVE') throw new UnauthorizedException('Account inactive');
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Account locked. Try again in ${mins} minutes`);
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 30 * 60000);
        await this.db.query('UPDATE users SET failed_attempts=0, locked_until=$1 WHERE id=$2', [lockUntil, user.id]);
      } else {
        await this.db.query('UPDATE users SET failed_attempts=$1 WHERE id=$2', [attempts, user.id]);
      }
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.db.query('UPDATE users SET failed_attempts=0, locked_until=NULL, last_login_at=NOW() WHERE id=$1', [user.id]);
    return user;
  }

  async login(user: any, ip?: string, userAgent?: string) {
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role, branchId: user.branch_id };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id, ip, userAgent);
    await this.db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, ip_address, user_agent) VALUES ($1,'LOGIN','User',$1,$2,$3)`,
      [user.id, ip || null, userAgent || null],
    );
    return { accessToken, refreshToken, expiresIn: this.getExpiry() };
  }

  async refresh(token: string) {
    const tokenHash = this.hashToken(token);
    const stored = await this.db.queryOne(
      `SELECT rt.*, u.id as uid, u.username, u.role, u.branch_id, u.status
       FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash=$1 AND rt.is_revoked=false`, [tokenHash],
    );
    if (!stored || new Date(stored.expires_at) < new Date()) throw new UnauthorizedException('Invalid or expired refresh token');
    await this.db.query('UPDATE refresh_tokens SET is_revoked=true WHERE id=$1', [stored.id]);
    return this.login({ id: stored.uid, username: stored.username, role: stored.role, branch_id: stored.branch_id });
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.db.query('UPDATE refresh_tokens SET is_revoked=true WHERE user_id=$1 AND token_hash=$2', [userId, this.hashToken(refreshToken)]);
    } else {
      await this.db.query('UPDATE refresh_tokens SET is_revoked=true WHERE user_id=$1', [userId]);
    }
    await this.db.query(`INSERT INTO audit_logs (user_id, action, entity, entity_id) VALUES ($1,'LOGOUT','User',$1)`, [userId]);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.db.queryOne('SELECT * FROM users WHERE id=$1', [userId]);
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) throw new BadRequestException('Current password is incorrect');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, userId]);
    await this.db.query('UPDATE refresh_tokens SET is_revoked=true WHERE user_id=$1', [userId]);
  }

  async getProfile(userId: string) {
    return this.db.queryOne(
      `SELECT u.id, u.username, u.email, u.full_name, u.full_name_ar, u.role, u.status,
              u.branch_id, u.avatar_url, u.last_login_at,
              CASE WHEN b.id IS NOT NULL THEN json_build_object('id',b.id,'code',b.code,'name',b.name,'nameAr',b.name_ar) ELSE NULL END as branch
       FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.id=$1`, [userId],
    );
  }

  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.db.queryOne('SELECT id, username, role, status, branch_id FROM users WHERE id=$1', [payload.sub]);
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('User inactive');
    return user;
  }

  async hashPasswordPublic(password: string) { return bcrypt.hash(password, 12); }

  private async generateRefreshToken(userId: string, ip?: string, userAgent?: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);
    const days = parseInt(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d')) || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 3600000);
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5)`,
      [userId, tokenHash, expiresAt, ip || null, userAgent || null],
    );
    return token;
  }

  private hashToken(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }

  private getExpiry(): number {
    const v = String(this.config.get('JWT_EXPIRES_IN', '15m'));
    const m = v.match(/^(\d+)([smhd])$/);
    if (!m) return 900;
    return parseInt(m[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2]] || 60);
  }
}
