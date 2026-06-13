import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsUUID, IsInt, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AdjustStockDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsUUID() branchId: string;
  @ApiProperty() @IsInt() quantity: number;
  @ApiProperty() @IsString() notes: string;
}

class CountItemDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsInt() @Min(0) actualQty: number;
}

class CountInventoryDto {
  @ApiProperty() @IsUUID() branchId: string;
  @ApiProperty({ type: [CountItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => CountItemDto) items: CountItemDto[];
}

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get current stock levels' })
  async getStock(@Query('branchId') branchId?: string, @Query('productId') productId?: string) {
    const data = await this.inventoryService.getStock(branchId, productId);
    return { success: true, data };
  }

  @Get('movements')
  @ApiOperation({ summary: 'Get inventory movements history' })
  async getMovements(
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const data = await this.inventoryService.getMovements(productId, branchId, +page, +limit);
    return { success: true, ...data };
  }

  @Post('adjust')
  @Roles('ADMIN', 'WAREHOUSE', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Manual stock adjustment' })
  async adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: any) {
    const data = await this.inventoryService.adjustStock(dto.productId, dto.branchId, dto.quantity, dto.notes, user.id);
    return { success: true, data };
  }

  @Post('count')
  @Roles('ADMIN', 'WAREHOUSE', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Submit inventory count results' })
  async count(@Body() dto: CountInventoryDto, @CurrentUser() user: any) {
    const data = await this.inventoryService.countInventory(dto.branchId, dto.items, user.id);
    return { success: true, data };
  }
}
