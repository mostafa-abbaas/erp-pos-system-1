import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/shifts')
export class ShiftsController {
  constructor(private svc: ShiftsService) {}
  @Get() async findAll(@Query() q: any) { return { success: true, ...(await this.svc.findAll(q)) }; }
  @Get('active') async active(@CurrentUser() user: any) { return { success: true, data: await this.svc.getActiveShift(user.id) }; }
  @Get(':id/report') async report(@Param('id') id: string) { return { success: true, data: await this.svc.getShiftReport(id) }; }
  @Post('open') @Roles('ADMIN','CASHIER','BRANCH_MANAGER')
  async open(@Body() body: any, @CurrentUser() user: any) { return { success: true, data: await this.svc.openShift(body, user.id) }; }
  @Patch(':id/close') @Roles('ADMIN','CASHIER','BRANCH_MANAGER')
  async close(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) { return { success: true, data: await this.svc.closeShift(id, body, user.id) }; }
}
