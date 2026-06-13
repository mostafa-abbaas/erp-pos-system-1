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
  constructor(private svc: ReportsService) {}

  @Get('dashboard')
  async dashboard(@Query('branchId') branchId?: string) {
    return { success: true, data: await this.svc.getDashboard(branchId) };
  }

  @Get('sales')
  async sales(@Query() q: any) {
    return { success: true, data: await this.svc.getSalesReport(q) };
  }

  @Get('profit')
  async profit(@Query() q: any) {
    return { success: true, data: await this.svc.getProfitReport(q) };
  }

  @Get('sales/export')
  async exportSales(@Query() q: any, @Res() res: Response) {
    const buf = await this.svc.exportSalesExcel(q);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="sales-${Date.now()}.xlsx"`,
    });
    res.send(buf);
  }
}
