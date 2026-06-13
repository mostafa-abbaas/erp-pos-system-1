import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  branchId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_FAILED = 5;
  private readonly LOCK_MINUTES = 30;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status === 'SUSPENDED') throw new UnauthorizedException('Account suspended');
    if (user.status === 'INACTIVE') throw new UnauthorizedException('Account inactive');

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Account locked. Try again in ${mins} minutes`);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedAttempts + 1;
      const updateData: any = { failedAttempts: attempts };
      if (attempts >= this.MAX_FAILED) {
        updateData.lockedUntil = new Date(Date.now() + this.LOCK_MINUTES * 60000);
        updateData.failedAttempts = 0;
      }
      await this.prisma.user.update({ where: { id: user.id }, data: updateData });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    return user;
  }

  async login(user: any, ip?: string, userAgent?: string): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id, ip, userAgent);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: ip,
        userAgent,
      },
    });

    this.eventEmitter.emit('user.login', { userId: user.id });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpiry(),
    };
  }

  async refresh(token: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, isRevoked: false },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    return this.login(stored.user);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all tokens for user
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }

    await this.prisma.auditLog.create({
      data: { userId, action: 'LOGOUT', entity: 'User', entityId: userId },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        fullNameAr: true,
        role: true,
        status: true,
        branchId: true,
        avatarUrl: true,
        lastLoginAt: true,
        branch: { select: { id: true, code: true, name: true, nameAr: true } },
      },
    });
  }

  private async generateRefreshToken(userId: string, ip?: string, userAgent?: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const days = parseInt(expiresIn) || 7;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        ipAddress: ip,
        userAgent,
      },
    });

    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getExpiry(): number {
    const expiresIn = this.config.get('JWT_EXPIRES_IN', '15m');
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const [, num, unit] = match;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(num) * (multipliers[unit] || 60);
  }
}
