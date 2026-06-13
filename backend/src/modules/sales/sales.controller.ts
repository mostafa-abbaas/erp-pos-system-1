import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RefundSaleDto } from './dto/refund-sale.dto';
import { SaleQueryDto } from './dto/sale-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/sales')
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Post()
  @Roles('ADMIN', 'CASHIER', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Create a new sale (POS checkout)' })
  async create(@Body() dto: CreateSaleDto, @CurrentUser() user: any) {
    const data = await this.salesService.create(dto, user.id);
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'List sales with filters' })
  async findAll(@Query() query: SaleQueryDto) {
    const data = await this.salesService.findAll(query);
    return { success: true, ...data };
  }

  @Get('daily-summary')
  @ApiOperation({ summary: 'Daily sales summary for a branch' })
  async dailySummary(@Query('branchId') branchId: string, @Query('date') date?: string) {
    const data = await this.salesService.getDailySummary(branchId, date);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale details with items' })
  async findOne(@Param('id') id: string) {
    const data = await this.salesService.findOne(id);
    return { success: true, data };
  }

  @Post(':id/refund')
  @Roles('ADMIN', 'BRANCH_MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Process a refund for a sale' })
  async refund(@Param('id') id: string, @Body() dto: RefundSaleDto, @CurrentUser() user: any) {
    const data = await this.salesService.refund(id, dto, user.id);
    return { success: true, data };
  }
}
