import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/inventory')
export class InventoryController {
  constructor(private svc: InventoryService) {}

  @Get()
  async stock(@Query('branchId') branchId?: string, @Query('productId') productId?: string) {
    return { success: true, data: await this.svc.getStock(branchId, productId) };
  }

  @Get('movements')
  async movements(@Query('productId') productId?: string, @Query('branchId') branchId?: string,
                  @Query('page') page = 1, @Query('limit') limit = 50) {
    return { success: true, ...(await this.svc.getMovements(productId, branchId, +page, +limit)) };
  }

  @Post('adjust')
  @Roles('ADMIN', 'WAREHOUSE', 'BRANCH_MANAGER')
  async adjust(@Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.svc.adjustStock(body.productId, body.branchId, body.quantity, body.notes, user.id) };
  }

  @Post('count')
  @Roles('ADMIN', 'WAREHOUSE', 'BRANCH_MANAGER')
  async count(@Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.svc.countInventory(body.branchId, body.items, user.id) };
  }
}
