import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/purchases')
export class PurchasesController {
  constructor(private svc: PurchasesService) {}

  @Get() async findAll(@Query() q: any) { return { success: true, ...(await this.svc.findAll(q)) }; }
  @Get('report') async report(@Query() q: any) { return { success: true, data: await this.svc.getPurchaseReport(q) }; }
  @Get('suppliers') async suppliers(@Query() q: any) { return { success: true, ...(await this.svc.getSuppliers(q)) }; }
  @Get(':id') async findOne(@Param('id') id: string) { return { success: true, data: await this.svc.findOne(id) }; }
  @Post() @Roles('ADMIN', 'WAREHOUSE', 'BRANCH_MANAGER')
  async create(@Body() body: any, @CurrentUser() user: any) { return { success: true, data: await this.svc.create(body, user.id) }; }
  @Post('suppliers') @Roles('ADMIN', 'BRANCH_MANAGER')
  async createSupplier(@Body() body: any) { return { success: true, data: await this.svc.createSupplier(body) }; }
  @Put('suppliers/:id') @Roles('ADMIN', 'BRANCH_MANAGER')
  async updateSupplier(@Param('id') id: string, @Body() body: any) { return { success: true, data: await this.svc.updateSupplier(id, body) }; }
}
