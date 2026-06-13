import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  async dashboard(@Query('branchId') branchId?: string) {
    const data = await this.reportsService.getDashboardStats(branchId);
    return { success: true, data };
  }

  @Get('sales')
  async sales(@Query() q: { branchId?: string; dateFrom: string; dateTo: string; groupBy?: 'day' | 'week' | 'month' }) {
    const data = await this.reportsService.getSalesReport(q);
    return { success: true, data };
  }

  @Get('profit')
  async profit(@Query() q: { branchId?: string; dateFrom: string; dateTo: string }) {
    const data = await this.reportsService.getProfitReport(q);
    return { success: true, data };
  }

  @Get('sales/export')
  async exportSales(@Query() q: { branchId?: string; dateFrom: string; dateTo: string }, @Res() res: Response) {
    const buffer = await this.reportsService.exportSalesExcel(q);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sales-report-${Date.now()}.xlsx"`,
    });
    res.send(buffer);
  }
}
