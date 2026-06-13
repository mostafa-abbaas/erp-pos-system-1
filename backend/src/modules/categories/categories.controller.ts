import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/categories')
export class CategoriesController {
  constructor(private svc: CategoriesService) {}
  @Get() async findAll(@Query() q: any) { return { success: true, ...(await this.svc.findAll(q)) }; }
  @Post() @Roles('ADMIN','BRANCH_MANAGER') async create(@Body() b: any) { return { success: true, data: await this.svc.create(b) }; }
  @Put(':id') @Roles('ADMIN','BRANCH_MANAGER') async update(@Param('id') id: string, @Body() b: any) { return { success: true, data: await this.svc.update(id, b) }; }
  @Delete(':id') @Roles('ADMIN') async remove(@Param('id') id: string) { await this.svc.remove(id); return { success: true }; }
  @Get('brands') async brands(@Query() q: any) { return { success: true, data: await this.svc.getBrands(q) }; }
  @Post('brands') @Roles('ADMIN','BRANCH_MANAGER') async createBrand(@Body() b: any) { return { success: true, data: await this.svc.createBrand(b) }; }
  @Put('brands/:id') @Roles('ADMIN','BRANCH_MANAGER') async updateBrand(@Param('id') id: string, @Body() b: any) { return { success: true, data: await this.svc.updateBrand(id, b) }; }
}
