import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ShiftsService {
  constructor(private db: DatabaseService) {}

  async openShift(dto: any, userId: string) {
    // Check no open shift exists for this cashier
    const existing = await this.db.queryOne(
      `SELECT id FROM shifts WHERE cashier_id = $1 AND closed_at IS NULL`, [userId]
    );
    if (existing) throw new BadRequestException('You already have an open shift. Please close it first.');

    const shift = await this.db.queryOne(
      `INSERT INTO shifts (branch_id, cashier_id, opening_balance, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dto.branchId, userId, dto.openingBalance ?? 0, dto.notes ?? null]
    );
    return shift;
  }

  async closeShift(shiftId: string, dto: any, userId: string) {
    const shift = await this.db.queryOne(
      `SELECT s.*, u.full_name as cashier_name, b.name as branch_name
       FROM shifts s JOIN users u ON s.cashier_id = u.id JOIN branches b ON s.branch_id = b.id
       WHERE s.id = $1`, [shiftId]
    );
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.cashier_id !== userId) throw new BadRequestException('Not your shift');
    if (shift.closed_at) throw new BadRequestException('Shift already closed');

    // Calculate actual sales during shift
    const salesSummary = await this.db.queryOne(
      `SELECT 
         COUNT(id)::int as sales_count,
         COALESCE(SUM(total),0) as total_sales,
         COALESCE(SUM(CASE WHEN payment_method='CASH' THEN total ELSE 0 END),0) as cash_sales,
         COALESCE(SUM(CASE WHEN payment_method='CARD' THEN total ELSE 0 END),0) as card_sales
       FROM sales
       WHERE cashier_id = $1 AND shift_id = $2 AND status IN ('COMPLETED','PARTIALLY_REFUNDED')`,
      [userId, shiftId]
    );

    const totalCash = Number(shift.opening_balance) + Number(salesSummary?.cash_sales ?? 0);
    const closingBalance = dto.closingBalance ?? totalCash;
    const difference = closingBalance - totalCash;

    const closed = await this.db.queryOne(
      `UPDATE shifts SET 
         closed_at = NOW(),
         closing_balance = $1,
         total_sales = $2,
         total_cash = $3,
         notes = COALESCE($4, notes)
       WHERE id = $5 RETURNING *`,
      [closingBalance, salesSummary?.total_sales ?? 0, salesSummary?.cash_sales ?? 0, dto.notes ?? null, shiftId]
    );

    return {
      shift: closed,
      summary: {
        openingBalance: Number(shift.opening_balance),
        salesCount: salesSummary?.sales_count ?? 0,
        totalSales: Number(salesSummary?.total_sales ?? 0),
        cashSales: Number(salesSummary?.cash_sales ?? 0),
        cardSales: Number(salesSummary?.card_sales ?? 0),
        expectedCash: totalCash,
        actualCash: closingBalance,
        difference,
      },
    };
  }

  async getActiveShift(userId: string) {
    return this.db.queryOne(
      `SELECT s.*,
         json_build_object('id',b.id,'code',b.code,'name',b.name) as branch,
         (SELECT COUNT(*)::int FROM sales WHERE shift_id = s.id AND status IN ('COMPLETED','PARTIALLY_REFUNDED')) as sales_count,
         (SELECT COALESCE(SUM(total),0) FROM sales WHERE shift_id = s.id AND status IN ('COMPLETED','PARTIALLY_REFUNDED')) as sales_total
       FROM shifts s JOIN branches b ON s.branch_id = b.id
       WHERE s.cashier_id = $1 AND s.closed_at IS NULL
       ORDER BY s.opened_at DESC LIMIT 1`,
      [userId]
    );
  }

  async findAll(query: any) {
    const { branchId, cashierId, isOpen, page = 1, limit = 20 } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (branchId) { conditions.push(`s.branch_id=$${i}`); params.push(branchId); i++; }
    if (cashierId) { conditions.push(`s.cashier_id=$${i}`); params.push(cashierId); i++; }
    if (isOpen === 'true') { conditions.push('s.closed_at IS NULL'); }
    if (isOpen === 'false') { conditions.push('s.closed_at IS NOT NULL'); }

    const offset = (page - 1) * limit;
    const where = conditions.join(' AND ');

    const [items, countRow] = await Promise.all([
      this.db.queryMany(
        `SELECT s.*,
           json_build_object('id',u.id,'fullName',u.full_name) as cashier,
           json_build_object('id',b.id,'code',b.code,'name',b.name) as branch,
           (SELECT COUNT(*)::int FROM sales sa WHERE sa.shift_id = s.id AND sa.status IN ('COMPLETED','PARTIALLY_REFUNDED')) as sales_count,
           (SELECT COALESCE(SUM(sa.total),0) FROM sales sa WHERE sa.shift_id = s.id AND sa.status IN ('COMPLETED','PARTIALLY_REFUNDED')) as sales_total
         FROM shifts s
         JOIN users u ON s.cashier_id = u.id
         JOIN branches b ON s.branch_id = b.id
         WHERE ${where}
         ORDER BY s.opened_at DESC LIMIT $${i} OFFSET $${i+1}`,
        [...params, limit, offset]
      ),
      this.db.queryOne<{ count: string }>(`SELECT COUNT(*)::int as count FROM shifts s WHERE ${where}`, params),
    ]);

    return { items, total: Number(countRow?.count ?? 0), page: +page, limit: +limit, totalPages: Math.ceil(Number(countRow?.count ?? 0) / limit) };
  }

  async getShiftReport(shiftId: string) {
    const shift = await this.db.queryOne(
      `SELECT s.*, u.full_name as cashier_name, b.name as branch_name
       FROM shifts s JOIN users u ON s.cashier_id = u.id JOIN branches b ON s.branch_id = b.id
       WHERE s.id = $1`, [shiftId]
    );
    if (!shift) throw new NotFoundException('Shift not found');

    const [salesByPayment, topProducts, hourlyBreakdown] = await Promise.all([
      this.db.queryMany(
        `SELECT payment_method, COUNT(id)::int as count, COALESCE(SUM(total),0) as total
         FROM sales WHERE shift_id=$1 AND status IN ('COMPLETED','PARTIALLY_REFUNDED')
         GROUP BY payment_method`, [shiftId]
      ),
      this.db.queryMany(
        `SELECT p.name, p.internal_code, SUM(si.quantity)::int as qty, SUM(si.total) as revenue
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN products p ON si.product_id = p.id
         WHERE s.shift_id = $1 AND s.status IN ('COMPLETED','PARTIALLY_REFUNDED')
         GROUP BY p.id, p.name, p.internal_code
         ORDER BY qty DESC LIMIT 10`, [shiftId]
      ),
      this.db.queryMany(
        `SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(id)::int as count, COALESCE(SUM(total),0) as total
         FROM sales WHERE shift_id=$1 AND status IN ('COMPLETED','PARTIALLY_REFUNDED')
         GROUP BY hour ORDER BY hour`, [shiftId]
      ),
    ]);

    return { shift, salesByPayment, topProducts, hourlyBreakdown };
  }
}
