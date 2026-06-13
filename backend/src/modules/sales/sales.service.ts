import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as dayjs from 'dayjs';

@Injectable()
export class SalesService {
  constructor(private db: DatabaseService) {}

  async create(dto: any, cashierId: string) {
    // 1. Validate products exist
    const ids = dto.items.map((i: any) => i.productId);
    const products = await this.db.queryMany(
      `SELECT * FROM products WHERE id = ANY($1) AND is_active = true`,
      [ids]
    );
    if (products.length !== ids.length) throw new BadRequestException('One or more products not found');
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // 2. Check inventory
    const inventory = await this.db.queryMany(
      `SELECT * FROM inventory WHERE product_id = ANY($1) AND branch_id = $2`,
      [ids, dto.branchId]
    );
    const invMap = new Map(inventory.map((i: any) => [i.product_id, i]));

    for (const item of dto.items) {
      const inv = invMap.get(item.productId);
      if (!inv || inv.quantity < item.quantity) {
        const p = productMap.get(item.productId);
        throw new BadRequestException(
          `Insufficient stock for "${p?.name}". Available: ${inv?.quantity ?? 0}`
        );
      }
    }

    // 3. Calculate totals
    let subtotal = 0;
    const lineItems: any[] = [];
    for (const item of dto.items) {
      const p = productMap.get(item.productId);
      const unitPrice = item.unitPrice ?? Number(p.selling_price);
      const discPct = item.discountPct ?? 0;
      const discAmt = (unitPrice * item.quantity * discPct) / 100;
      const taxRate = Number(p.tax_rate ?? 0);
      const taxable = unitPrice * item.quantity - discAmt;
      const taxAmt = (taxable * taxRate) / 100;
      const total = taxable + taxAmt;
      subtotal += unitPrice * item.quantity;
      lineItems.push({ ...item, unitPrice, discPct, discAmt, taxRate, taxAmt, total, costPrice: Number(p.purchase_price) });
    }

    const discountAmount = dto.discountAmount ?? ((subtotal * (dto.discountPct ?? 0)) / 100);
    const taxTotal = lineItems.reduce((s, i) => s + i.taxAmt, 0);
    const total = subtotal - discountAmount + taxTotal;
    const amountPaid = dto.amountPaid ?? total;
    const changeAmount = Math.max(0, amountPaid - total);

    // 4. Invoice number
    const branch = await this.db.queryOne('SELECT code FROM branches WHERE id = $1', [dto.branchId]);
    if (!branch) throw new BadRequestException('Branch not found');
    const todayCount = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM sales WHERE branch_id = $1 AND created_at >= $2`,
      [dto.branchId, dayjs().startOf('day').toDate()]
    );
    const seq = String((parseInt(todayCount?.count ?? '0')) + 1).padStart(4, '0');
    const invoiceNumber = `${branch.code}-${dayjs().format('YYYYMMDD')}-${seq}`;

    // 5. Transaction
    return this.db.transaction(async (client) => {
      // Create sale
      const saleRow = await client.query(
        `INSERT INTO sales (invoice_number, branch_id, cashier_id, customer_id, subtotal,
           discount_amount, discount_pct, tax_amount, total, payment_method, amount_paid,
           change_amount, notes, shift_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'COMPLETED')
         RETURNING *`,
        [invoiceNumber, dto.branchId, cashierId, dto.customerId || null,
         subtotal, discountAmount, dto.discountPct ?? 0, taxTotal, total,
         dto.paymentMethod, amountPaid, changeAmount, dto.notes || null, dto.shiftId || null]
      );
      const sale = saleRow.rows[0];

      // Create sale items + update inventory
      for (const item of lineItems) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_pct,
             discount_amount, tax_rate, tax_amount, total, cost_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [sale.id, item.productId, item.quantity, item.unitPrice, item.discPct,
           item.discAmt, item.taxRate, item.taxAmt, item.total, item.costPrice]
        );

        const inv = invMap.get(item.productId);
        const newQty = inv.quantity - item.quantity;
        await client.query(
          `UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE id = $2`,
          [newQty, inv.id]
        );
        await client.query(
          `INSERT INTO inventory_movements (product_id, branch_id, type, quantity, quantity_before, quantity_after, unit_cost, reference_id, reference_type, created_by)
           VALUES ($1,$2,'SALE',$3,$4,$5,$6,$7,'Sale',$8)`,
          [item.productId, dto.branchId, -item.quantity, inv.quantity, newQty, item.costPrice, sale.id, cashierId]
        );
      }

      // Update customer totals
      if (dto.customerId) {
        await client.query(
          'UPDATE customers SET total_purchases = total_purchases + $1, updated_at = NOW() WHERE id = $2',
          [total, dto.customerId]
        );
      }

      // Return full sale
      const fullSale = await client.query(
        `SELECT s.*,
           json_build_object('id',u.id,'fullName',u.full_name) as cashier,
           json_build_object('id',b.id,'code',b.code,'name',b.name) as branch
         FROM sales s
         JOIN users u ON s.cashier_id = u.id
         JOIN branches b ON s.branch_id = b.id
         WHERE s.id = $1`, [sale.id]
      );
      return fullSale.rows[0];
    });
  }

  async findAll(query: any) {
    const { branchId, cashierId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (branchId) { conditions.push(`s.branch_id = $${i}`); params.push(branchId); i++; }
    if (cashierId) { conditions.push(`s.cashier_id = $${i}`); params.push(cashierId); i++; }
    if (status) { conditions.push(`s.status = $${i}`); params.push(status); i++; }
    if (dateFrom) { conditions.push(`s.created_at >= $${i}`); params.push(dateFrom); i++; }
    if (dateTo) { conditions.push(`s.created_at <= $${i}`); params.push(dateTo); i++; }

    const offset = (page - 1) * limit;
    const where = conditions.join(' AND ');

    const [items, countRow] = await Promise.all([
      this.db.queryMany(
        `SELECT s.*,
           json_build_object('id',u.id,'fullName',u.full_name,'username',u.username) as cashier,
           json_build_object('id',b.id,'code',b.code,'name',b.name) as branch,
           (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id)::int as item_count
         FROM sales s
         JOIN users u ON s.cashier_id = u.id
         JOIN branches b ON s.branch_id = b.id
         WHERE ${where}
         ORDER BY s.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      this.db.queryOne<{ count: string }>(`SELECT COUNT(*) FROM sales s WHERE ${where}`, params),
    ]);

    const total = parseInt(countRow?.count ?? '0');
    return { items, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const sale = await this.db.queryOne(
      `SELECT s.*,
         json_build_object('id',u.id,'fullName',u.full_name,'fullNameAr',u.full_name_ar) as cashier,
         json_build_object('id',b.id,'code',b.code,'name',b.name,'nameAr',b.name_ar) as branch
       FROM sales s
       JOIN users u ON s.cashier_id = u.id
       JOIN branches b ON s.branch_id = b.id
       WHERE s.id = $1`, [id]
    );
    if (!sale) throw new NotFoundException('Sale not found');

    const items = await this.db.queryMany(
      `SELECT si.*, json_build_object('id',p.id,'name',p.name,'nameAr',p.name_ar,'internalCode',p.internal_code) as product
       FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1`, [id]
    );
    return { ...sale, items };
  }

  async refund(id: string, dto: any, userId: string) {
    const sale = await this.findOne(id);
    if (sale.status === 'REFUNDED') throw new BadRequestException('Already fully refunded');
    if (sale.status === 'CANCELLED') throw new BadRequestException('Cannot refund cancelled sale');

    return this.db.transaction(async (client) => {
      let refundTotal = 0;
      const refundItems: any[] = [];

      for (const item of dto.items) {
        const saleItem = sale.items.find((i: any) => i.id === item.saleItemId);
        if (!saleItem) throw new BadRequestException(`Sale item ${item.saleItemId} not found`);
        if (item.quantity > saleItem.quantity) throw new BadRequestException('Refund quantity exceeds sold quantity');
        const itemTotal = Number(saleItem.unit_price) * item.quantity * (1 - Number(saleItem.discount_pct) / 100);
        refundTotal += itemTotal;
        refundItems.push({ ...item, total: itemTotal, productId: saleItem.product_id });
      }

      const refundRow = await client.query(
        `INSERT INTO refunds (sale_id, processed_by, reason, total, payment_method)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [id, userId, dto.reason, refundTotal, dto.paymentMethod]
      );
      const refund = refundRow.rows[0];

      for (const item of refundItems) {
        await client.query(
          `INSERT INTO refund_items (refund_id, sale_item_id, quantity, total) VALUES ($1,$2,$3,$4)`,
          [refund.id, item.saleItemId, item.quantity, item.total]
        );
        await client.query(
          `INSERT INTO inventory (product_id, branch_id, quantity)
           VALUES ($1,$2,$3)
           ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = inventory.quantity + $3, updated_at = NOW()`,
          [item.productId, sale.branch_id, item.quantity]
        );
        await client.query(
          `INSERT INTO inventory_movements (product_id, branch_id, type, quantity, quantity_before, quantity_after, reference_id, reference_type, created_by)
           SELECT $1,$2,'RETURN',$3,i.quantity,i.quantity+$3,$4,'Refund',$5
           FROM inventory i WHERE i.product_id=$1 AND i.branch_id=$2`,
          [item.productId, sale.branch_id, item.quantity, refund.id, userId]
        );
      }

      await client.query(`UPDATE sales SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1`, [id]);
      return refund;
    });
  }

  async getDailySummary(branchId: string, date?: string) {
    const d = date ? dayjs(date) : dayjs();
    const start = d.startOf('day').toDate();
    const end = d.endOf('day').toDate();

    const [agg, breakdown] = await Promise.all([
      this.db.queryOne(
        `SELECT COUNT(id)::int as sales_count, COALESCE(SUM(total),0) as sales_total,
                COALESCE(SUM(discount_amount),0) as discount_total, COALESCE(SUM(tax_amount),0) as tax_total
         FROM sales WHERE branch_id=$1 AND status IN ('COMPLETED','PARTIALLY_REFUNDED')
         AND created_at BETWEEN $2 AND $3`,
        [branchId, start, end]
      ),
      this.db.queryMany(
        `SELECT payment_method, COUNT(id)::int as count, COALESCE(SUM(total),0) as total
         FROM sales WHERE branch_id=$1 AND status IN ('COMPLETED','PARTIALLY_REFUNDED')
         AND created_at BETWEEN $2 AND $3 GROUP BY payment_method`,
        [branchId, start, end]
      ),
    ]);

    return {
      date: d.format('YYYY-MM-DD'),
      salesCount: agg?.sales_count ?? 0,
      salesTotal: Number(agg?.sales_total ?? 0),
      discountTotal: Number(agg?.discount_total ?? 0),
      taxTotal: Number(agg?.tax_total ?? 0),
      paymentBreakdown: breakdown,
    };
  }
}
