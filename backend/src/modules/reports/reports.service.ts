import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as dayjs from 'dayjs';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  constructor(private db: DatabaseService) {}

  async getDashboard(branchId?: string) {
    const branchFilter = branchId ? `AND branch_id = '${branchId}'` : '';
    const today = dayjs().startOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();

    const [todaySales, monthSales, totalProducts, lowStock, pendingTransfers, topProducts] = await Promise.all([
      this.db.queryOne(
        `SELECT COUNT(id)::int as count, COALESCE(SUM(total),0) as total
         FROM sales WHERE status IN ('COMPLETED','PARTIALLY_REFUNDED')
         AND created_at >= $1 ${branchFilter}`, [today]
      ),
      this.db.queryOne(
        `SELECT COUNT(id)::int as count, COALESCE(SUM(total),0) as total
         FROM sales WHERE status IN ('COMPLETED','PARTIALLY_REFUNDED')
         AND created_at >= $1 ${branchFilter}`, [monthStart]
      ),
      this.db.queryOne<{ count: string }>('SELECT COUNT(*)::int as count FROM products WHERE is_active = true'),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM inventory i
         JOIN products p ON i.product_id = p.id
         WHERE p.is_active = true AND i.quantity <= p.min_stock_alert ${branchId ? `AND i.branch_id = '${branchId}'` : ''}`
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM transfers WHERE status IN ('PENDING','APPROVED')`
      ),
      this.db.queryMany(
        `SELECT si.product_id, SUM(si.quantity)::int as qty_sold, SUM(si.total) as revenue
         FROM sale_items si JOIN sales s ON si.sale_id = s.id
         WHERE s.status IN ('COMPLETED','PARTIALLY_REFUNDED') AND s.created_at >= $1 ${branchFilter}
         GROUP BY si.product_id ORDER BY qty_sold DESC LIMIT 5`, [monthStart]
      ),
    ]);

    const productIds = topProducts.map((p: any) => p.product_id);
    const productDetails = productIds.length
      ? await this.db.queryMany(`SELECT id, name, name_ar, internal_code FROM products WHERE id = ANY($1)`, [productIds])
      : [];
    const pdMap = new Map(productDetails.map((p: any) => [p.id, p]));

    return {
      today: { salesCount: todaySales?.count ?? 0, salesTotal: Number(todaySales?.total ?? 0) },
      thisMonth: { salesCount: monthSales?.count ?? 0, salesTotal: Number(monthSales?.total ?? 0) },
      totalProducts: totalProducts?.count ?? 0,
      lowStockCount: lowStock?.count ?? 0,
      pendingTransfers: pendingTransfers?.count ?? 0,
      topProducts: topProducts.map((tp: any) => ({
        product: pdMap.get(tp.product_id),
        quantitySold: tp.qty_sold,
        totalRevenue: Number(tp.revenue),
      })),
    };
  }

  async getSalesReport(params: { branchId?: string; dateFrom: string; dateTo: string; groupBy?: string }) {
    const { branchId, dateFrom, dateTo, groupBy = 'day' } = params;
    const branchFilter = branchId ? `AND s.branch_id = '${branchId}'` : '';
    const fmt = groupBy === 'month' ? 'YYYY-MM' : groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM-DD';

    const [summary, timeSeries, topProducts] = await Promise.all([
      this.db.queryOne(
        `SELECT COUNT(id)::int as count, COALESCE(SUM(total),0) as revenue,
                COALESCE(SUM(discount_amount),0) as discount, COALESCE(SUM(tax_amount),0) as tax,
                COALESCE(AVG(total),0) as avg_order
         FROM sales WHERE status IN ('COMPLETED','PARTIALLY_REFUNDED')
         AND created_at BETWEEN $1 AND $2 ${branchFilter}`,
        [dateFrom, dateTo]
      ),
      this.db.queryMany(
        `SELECT TO_CHAR(created_at, '${fmt}') as period,
                COUNT(id)::int as sales_count, COALESCE(SUM(total),0) as total
         FROM sales WHERE status IN ('COMPLETED','PARTIALLY_REFUNDED')
         AND created_at BETWEEN $1 AND $2 ${branchFilter}
         GROUP BY period ORDER BY period`,
        [dateFrom, dateTo]
      ),
      this.db.queryMany(
        `SELECT si.product_id, SUM(si.quantity)::int as qty, SUM(si.total) as revenue
         FROM sale_items si JOIN sales s ON si.sale_id = s.id
         WHERE s.status IN ('COMPLETED','PARTIALLY_REFUNDED')
         AND s.created_at BETWEEN $1 AND $2 ${branchFilter}
         GROUP BY si.product_id ORDER BY revenue DESC LIMIT 10`,
        [dateFrom, dateTo]
      ),
    ]);

    const productIds = topProducts.map((p: any) => p.product_id);
    const productDetails = productIds.length
      ? await this.db.queryMany(`SELECT id, name, name_ar, internal_code FROM products WHERE id = ANY($1)`, [productIds])
      : [];
    const pdMap = new Map(productDetails.map((p: any) => [p.id, p]));

    return {
      summary: {
        salesCount: summary?.count ?? 0,
        totalRevenue: Number(summary?.revenue ?? 0),
        totalDiscount: Number(summary?.discount ?? 0),
        totalTax: Number(summary?.tax ?? 0),
        avgOrderValue: Number(summary?.avg_order ?? 0),
      },
      timeSeries: timeSeries.map((r: any) => ({
        period: r.period,
        salesCount: r.sales_count,
        total: Number(r.total),
      })),
      topProducts: topProducts.map((tp: any) => ({
        product: pdMap.get(tp.product_id),
        quantitySold: tp.qty,
        totalRevenue: Number(tp.revenue),
      })),
    };
  }

  async getProfitReport(params: { branchId?: string; dateFrom: string; dateTo: string }) {
    const { branchId, dateFrom, dateTo } = params;
    const branchFilter = branchId ? `AND s.branch_id = '${branchId}'` : '';

    const items = await this.db.queryMany(
      `SELECT si.product_id, si.quantity, si.total, si.cost_price, p.name, p.name_ar, p.purchase_price
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       WHERE s.status IN ('COMPLETED','PARTIALLY_REFUNDED')
       AND s.created_at BETWEEN $1 AND $2 ${branchFilter}`,
      [dateFrom, dateTo]
    );

    let totalRevenue = 0, totalCost = 0;
    const byProduct = new Map<string, any>();

    for (const i of items) {
      const rev = Number(i.total);
      const cost = Number(i.cost_price ?? i.purchase_price) * Number(i.quantity);
      totalRevenue += rev; totalCost += cost;
      if (!byProduct.has(i.product_id)) {
        byProduct.set(i.product_id, { product: { id: i.product_id, name: i.name, nameAr: i.name_ar }, revenue: 0, cost: 0, profit: 0, quantity: 0 });
      }
      const pp = byProduct.get(i.product_id);
      pp.revenue += rev; pp.cost += cost; pp.profit += rev - cost; pp.quantity += Number(i.quantity);
    }

    const grossProfit = totalRevenue - totalCost;
    return {
      totalRevenue,
      totalCost,
      grossProfit,
      marginPct: totalRevenue > 0 ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0,
      byProduct: Array.from(byProduct.values()).sort((a, b) => b.profit - a.profit).slice(0, 20),
    };
  }

  async exportSalesExcel(params: { branchId?: string; dateFrom: string; dateTo: string }): Promise<any> {
    const { branchId, dateFrom, dateTo } = params;
    const branchFilter = branchId ? `AND s.branch_id = '${branchId}'` : '';
    const sales = await this.db.queryMany(
      `SELECT s.invoice_number, s.created_at, s.subtotal, s.discount_amount, s.tax_amount,
              s.total, s.payment_method, s.status,
              u.full_name as cashier_name, b.name as branch_name
       FROM sales s
       JOIN users u ON s.cashier_id = u.id
       JOIN branches b ON s.branch_id = b.id
       WHERE s.status IN ('COMPLETED','PARTIALLY_REFUNDED')
       AND s.created_at BETWEEN $1 AND $2 ${branchFilter}
       ORDER BY s.created_at DESC`,
      [dateFrom, dateTo]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sales Report');
    ws.columns = [
      { header: 'Invoice #', key: 'invoice_number', width: 22 },
      { header: 'Date', key: 'created_at', width: 20 },
      { header: 'Branch', key: 'branch_name', width: 15 },
      { header: 'Cashier', key: 'cashier_name', width: 20 },
      { header: 'Subtotal', key: 'subtotal', width: 12 },
      { header: 'Discount', key: 'discount_amount', width: 12 },
      { header: 'Tax', key: 'tax_amount', width: 10 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Payment', key: 'payment_method', width: 15 },
    ];
    ws.getRow(1).font = { bold: true };
    sales.forEach(s => ws.addRow({ ...s, created_at: dayjs(s.created_at).format('YYYY-MM-DD HH:mm') }));
    return wb.xlsx.writeBuffer() as Promise<any>;
  }
}
