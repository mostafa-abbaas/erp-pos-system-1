import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/transfers')
export class TransfersController {
  constructor(private svc: TransfersService) {}
  @Get() async findAll(@Query() q: any) { return { success: true, ...(await this.svc.findAll(q)) }; }
  @Get(':id') async findOne(@Param('id') id: string) { return { success: true, data: await this.svc.findOne(id) }; }
  @Post() @Roles('ADMIN', 'WAREHOUSE', 'BRANCH_MANAGER')
  async create(@Body() body: any, @CurrentUser() user: any) { return { success: true, data: await this.svc.create(body, user.id) }; }
  @Patch(':id/status') @Roles('ADMIN', 'WAREHOUSE', 'BRANCH_MANAGER')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }, @CurrentUser() user: any) {
    return { success: true, data: await this.svc.updateStatus(id, body.status, user.id) };
  }
}
