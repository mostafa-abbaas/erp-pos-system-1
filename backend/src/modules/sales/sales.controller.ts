import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/sales')
export class SalesController {
  constructor(private svc: SalesService) {}

  @Post()
  @Roles('ADMIN', 'CASHIER', 'BRANCH_MANAGER')
  async create(@Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.svc.create(body, user.id) };
  }

  @Get()
  async findAll(@Query() q: any) {
    return { success: true, ...(await this.svc.findAll(q)) };
  }

  @Get('daily-summary')
  async dailySummary(@Query('branchId') branchId: string, @Query('date') date?: string) {
    return { success: true, data: await this.svc.getDailySummary(branchId, date) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.svc.findOne(id) };
  }

  @Post(':id/refund')
  @Roles('ADMIN', 'BRANCH_MANAGER', 'CASHIER')
  async refund(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.svc.refund(id, body, user.id) };
  }
}
