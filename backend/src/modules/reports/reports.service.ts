import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as dayjs from 'dayjs';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(branchId?: string) {
    const today = dayjs().startOf('day').toDate();
    const thisMonth = dayjs().startOf('month').toDate();

    const salesWhere: any = { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } };
    if (branchId) salesWhere.branchId = branchId;

    const [
      todaySales,
      monthSales,
      totalProducts,
      lowStockCount,
      pendingTransfers,
      topProducts,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { ...salesWhere, createdAt: { gte: today } },
        _sum: { total: true },
        _count: { id: true },
      }),
      this.prisma.sale.aggregate({
        where: { ...salesWhere, createdAt: { gte: thisMonth } },
        _sum: { total: true },
        _count: { id: true },
      }),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::int as count FROM inventory i
        JOIN products p ON i.product_id = p.id
        WHERE p.is_active = true AND i.quantity <= p.min_stock_alert
        ${branchId ? this.prisma.$queryRaw`AND i.branch_id = ${branchId}::uuid` : this.prisma.$queryRaw``}
      `,
      this.prisma.transfer.count({
        where: { status: { in: ['PENDING', 'APPROVED'] } },
      }),
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: { ...salesWhere, createdAt: { gte: thisMonth } },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const topProductDetails = await this.prisma.product.findMany({
      where: { id: { in: topProducts.map(p => p.productId) } },
      select: { id: true, name: true, nameAr: true, internalCode: true },
    });

    const topProductMap = new Map(topProductDetails.map(p => [p.id, p]));

    return {
      today: {
        salesCount: todaySales._count.id,
        salesTotal: Number(todaySales._sum.total ?? 0),
      },
      thisMonth: {
        salesCount: monthSales._count.id,
        salesTotal: Number(monthSales._sum.total ?? 0),
      },
      totalProducts,
      lowStockCount: Number((lowStockCount[0] as any)?.count ?? 0),
      pendingTransfers,
      topProducts: topProducts.map(tp => ({
        product: topProductMap.get(tp.productId),
        quantitySold: Number(tp._sum.quantity ?? 0),
        totalRevenue: Number(tp._sum.total ?? 0),
      })),
    };
  }

  async getSalesReport(params: {
    branchId?: string;
    dateFrom: string;
    dateTo: string;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const { branchId, dateFrom, dateTo, groupBy = 'day' } = params;
    const where: any = {
      status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
    };
    if (branchId) where.branchId = branchId;

    // Raw SQL for time-series grouping
    const format = groupBy === 'month' ? 'YYYY-MM' : groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM-DD';
    const pgFormat = groupBy === 'month' ? 'YYYY-MM' : groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM-DD';

    const timeSeries = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        TO_CHAR(created_at, '${pgFormat}') as period,
        COUNT(id) as sales_count,
        SUM(total) as total,
        SUM(discount_amount) as discount_total,
        SUM(tax_amount) as tax_total
      FROM sales
      WHERE status IN ('COMPLETED', 'PARTIALLY_REFUNDED')
        AND created_at >= '${dateFrom}'
        AND created_at <= '${dateTo}'
        ${branchId ? `AND branch_id = '${branchId}'` : ''}
      GROUP BY period
      ORDER BY period ASC
    `);

    const summary = await this.prisma.sale.aggregate({
      where,
      _sum: { total: true, discountAmount: true, taxAmount: true },
      _count: { id: true },
      _avg: { total: true },
    });

    // Top products
    const topProducts = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: where },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    });

    const productDetails = await this.prisma.product.findMany({
      where: { id: { in: topProducts.map(p => p.productId) } },
      select: { id: true, name: true, nameAr: true, internalCode: true, category: { select: { name: true } } },
    });
    const productMap = new Map(productDetails.map(p => [p.id, p]));

    return {
      summary: {
        salesCount: summary._count.id,
        totalRevenue: Number(summary._sum.total ?? 0),
        totalDiscount: Number(summary._sum.discountAmount ?? 0),
        totalTax: Number(summary._sum.taxAmount ?? 0),
        avgOrderValue: Number(summary._avg.total ?? 0),
      },
      timeSeries: timeSeries.map(row => ({
        period: row.period,
        salesCount: Number(row.sales_count),
        total: Number(row.total),
        discountTotal: Number(row.discount_total),
        taxTotal: Number(row.tax_total),
      })),
      topProducts: topProducts.map(tp => ({
        product: productMap.get(tp.productId),
        quantitySold: Number(tp._sum.quantity ?? 0),
        totalRevenue: Number(tp._sum.total ?? 0),
      })),
    };
  }

  async getProfitReport(params: { branchId?: string; dateFrom: string; dateTo: string }) {
    const { branchId, dateFrom, dateTo } = params;

    const items = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
          createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
          ...(branchId && { branchId }),
        },
      },
      include: {
        product: { select: { id: true, name: true, nameAr: true, purchasePrice: true } },
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;
    const productProfits = new Map<string, any>();

    for (const item of items) {
      const revenue = Number(item.total);
      const cost = (item.costPrice ? Number(item.costPrice) : Number(item.product.purchasePrice)) * item.quantity;
      totalRevenue += revenue;
      totalCost += cost;

      if (!productProfits.has(item.productId)) {
        productProfits.set(item.productId, {
          product: item.product,
          revenue: 0, cost: 0, profit: 0, quantity: 0,
        });
      }
      const pp = productProfits.get(item.productId);
      pp.revenue += revenue;
      pp.cost += cost;
      pp.profit += revenue - cost;
      pp.quantity += item.quantity;
    }

    const grossProfit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      marginPct: parseFloat(marginPct.toFixed(2)),
      byProduct: Array.from(productProfits.values())
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 20),
    };
  }

  async exportSalesExcel(params: { branchId?: string; dateFrom: string; dateTo: string }): Promise<Buffer> {
    const { branchId, dateFrom, dateTo } = params;
    const sales = await this.prisma.sale.findMany({
      where: {
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
        createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        ...(branchId && { branchId }),
      },
      include: {
        cashier: { select: { fullName: true } },
        customer: { select: { name: true } },
        branch: { select: { name: true } },
        items: { include: { product: { select: { name: true, internalCode: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sales Report');

    sheet.columns = [
      { header: 'Invoice #', key: 'invoice', width: 20 },
      { header: 'Date', key: 'date', width: 18 },
      { header: 'Branch', key: 'branch', width: 15 },
      { header: 'Cashier', key: 'cashier', width: 20 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Items', key: 'items', width: 8 },
      { header: 'Subtotal', key: 'subtotal', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Tax', key: 'tax', width: 10 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Payment', key: 'payment', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };

    sales.forEach(s => {
      sheet.addRow({
        invoice: s.invoiceNumber,
        date: dayjs(s.createdAt).format('YYYY-MM-DD HH:mm'),
        branch: s.branch.name,
        cashier: s.cashier.fullName,
        customer: s.customer?.name ?? '-',
        items: s.items.length,
        subtotal: Number(s.subtotal),
        discount: Number(s.discountAmount),
        tax: Number(s.taxAmount),
        total: Number(s.total),
        payment: s.paymentMethod,
        status: s.status,
      });
    });

    // Totals row
    const lastRow = sheet.lastRow!.number + 1;
    sheet.getCell(`G${lastRow}`).value = { formula: `SUM(G2:G${lastRow - 1})` };
    sheet.getCell(`H${lastRow}`).value = { formula: `SUM(H2:H${lastRow - 1})` };
    sheet.getCell(`J${lastRow}`).value = { formula: `SUM(J2:J${lastRow - 1})` };
    sheet.getRow(lastRow).font = { bold: true };

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }
}
