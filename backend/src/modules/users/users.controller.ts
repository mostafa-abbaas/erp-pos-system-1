import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private svc: UsersService) {}

  @Get() @Roles('ADMIN','BRANCH_MANAGER')
  async findAll(@Query() q: any) { return { success: true, ...(await this.svc.findAll(q)) }; }

  @Get('branches') async getBranches() { return { success: true, data: await this.svc.getBranches() }; }

  @Get('audit-logs') @Roles('ADMIN')
  async auditLogs(@Query() q: any) { return { success: true, ...(await this.svc.getAuditLogs(q)) }; }

  @Get(':id') @Roles('ADMIN','BRANCH_MANAGER')
  async findOne(@Param('id') id: string) { return { success: true, data: await this.svc.findOne(id) }; }

  @Post() @Roles('ADMIN')
  async create(@Body() body: any) { return { success: true, data: await this.svc.create(body) }; }

  @Post('branches') @Roles('ADMIN')
  async createBranch(@Body() body: any) { return { success: true, data: await this.svc.createBranch(body) }; }

  @Put(':id') @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() body: any) { return { success: true, data: await this.svc.update(id, body) }; }

  @Patch(':id/reset-password')
  async resetPassword(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.svc.resetPassword(id, body, user.id, user.role) };
  }

  @Patch(':id/deactivate') @Roles('ADMIN')
  async deactivate(@Param('id') id: string) { return { success: true, data: await this.svc.deactivate(id) }; }
}
