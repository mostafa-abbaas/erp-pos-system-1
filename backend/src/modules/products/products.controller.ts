import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/products')
export class ProductsController {
  constructor(private svc: ProductsService) {}

  @Get()
  async findAll(@Query() q: any) {
    return { success: true, ...(await this.svc.findAll(q)) };
  }

  @Get('low-stock')
  async lowStock(@Query('branchId') branchId?: string) {
    return { success: true, data: await this.svc.getLowStock(branchId) };
  }

  @Get('categories')
  async categories() {
    return { success: true, data: await this.svc.getCategories() };
  }

  @Get('brands')
  async brands() {
    return { success: true, data: await this.svc.getBrands() };
  }

  @Get('suppliers')
  async suppliers() {
    return { success: true, data: await this.svc.getSuppliers() };
  }

  @Get('export/excel')
  async exportExcel(@Res() res: Response) {
    const buf = await this.svc.exportToExcel();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="products-${Date.now()}.xlsx"`,
    });
    res.send(buf);
  }

  @Get('barcode/:barcode')
  async byBarcode(@Param('barcode') barcode: string) {
    return { success: true, data: await this.svc.findByBarcode(barcode) };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.svc.findOne(id) };
  }

  @Post()
  @Roles('ADMIN', 'BRANCH_MANAGER')
  async create(@Body() body: any, @CurrentUser() user: any) {
    return { success: true, data: await this.svc.create(body, user.id) };
  }

  @Post('import/excel')
  @Roles('ADMIN', 'BRANCH_MANAGER')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  async importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (!file) throw new Error('File required');
    return { success: true, data: await this.svc.importFromExcel(file.buffer, user.id) };
  }

  @Put(':id')
  @Roles('ADMIN', 'BRANCH_MANAGER')
  async update(@Param('id') id: string, @Body() body: any) {
    return { success: true, data: await this.svc.update(id, body) };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
    return { success: true, message: 'Product deactivated' };
  }
}
