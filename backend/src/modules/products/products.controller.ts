import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @Roles('ADMIN', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Create a new product' })
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    const data = await this.productsService.create(dto, user.id);
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'List products with search & filters' })
  async findAll(@Query() query: ProductQueryDto) {
    const data = await this.productsService.findAll(query);
    return { success: true, ...data };
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock products' })
  async lowStock(@Query('branchId') branchId?: string) {
    const data = await this.productsService.getLowStockProducts(branchId);
    return { success: true, data };
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Fast barcode lookup' })
  async findByBarcode(@Param('barcode') barcode: string) {
    const data = await this.productsService.findByBarcode(barcode);
    return { success: true, data };
  }

  @Get('export/excel')
  @ApiOperation({ summary: 'Export all products to Excel' })
  async exportExcel(@Res() res: Response) {
    const buffer = await this.productsService.exportToExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="products-${Date.now()}.xlsx"`,
    });
    res.send(buffer);
  }

  @Post('import/excel')
  @Roles('ADMIN', 'BRANCH_MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import products from Excel/CSV' })
  async importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (!file) throw new Error('File is required');
    const data = await this.productsService.importFromExcel(file.buffer, user.id);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.productsService.findOne(id);
    return { success: true, data };
  }

  @Put(':id')
  @Roles('ADMIN', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Update product' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: any) {
    const data = await this.productsService.update(id, dto, user.id);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate product (soft delete)' })
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return { success: true, message: 'Product deactivated' };
  }
}
