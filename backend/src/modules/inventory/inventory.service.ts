import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class InventoryService {
  constructor(private db: DatabaseService) {}

  async getStock(branchId?: string, productId?: string) {
    const conditions = ['p.is_active = true'];
    const params: any[] = [];
    let i = 1;
    if (branchId) { conditions.push(`i.branch_id = $${i}`); params.push(branchId); i++; }
    if (productId) { conditions.push(`i.product_id = $${i}`); params.push(productId); i++; }

    return this.db.queryMany(
      `SELECT i.*,
         json_build_object('id',p.id,'name',p.name,'nameAr',p.name_ar,'internalCode',p.internal_code,
           'barcode',p.barcode,'minStockAlert',p.min_stock_alert,
           'category', json_build_object('id',c.id,'name',c.name)) as product,
         json_build_object('id',b.id,'code',b.code,'name',b.name) as branch
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       JOIN branches b ON i.branch_id = b.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.code, p.name`,
      params
    );
  }

  async adjustStock(productId: string, branchId: string, qty: number, notes: string, userId: string, type = 'ADJUSTMENT') {
    return this.db.transaction(async (client) => {
      const inv = await client.query(
        `SELECT * FROM inventory WHERE product_id = $1 AND branch_id = $2 FOR UPDATE`,
        [productId, branchId]
      );

      let current = inv.rows[0];
      if (!current) {
        const ins = await client.query(
          `INSERT INTO inventory (product_id, branch_id, quantity) VALUES ($1, $2, 0) RETURNING *`,
          [productId, branchId]
        );
        current = ins.rows[0];
      }

      const newQty = current.quantity + qty;
      if (newQty < 0) throw new BadRequestException('Stock cannot go below zero');

      await client.query(
        `UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE id = $2`,
        [newQty, current.id]
      );

      await client.query(
        `INSERT INTO inventory_movements (product_id, branch_id, type, quantity, quantity_before, quantity_after, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [productId, branchId, type, qty, current.quantity, newQty, notes, userId]
      );

      return { productId, branchId, before: current.quantity, after: newQty, diff: qty };
    });
  }

  async getMovements(productId?: string, branchId?: string, page = 1, limit = 50) {
    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (productId) { conditions.push(`m.product_id = $${i}`); params.push(productId); i++; }
    if (branchId) { conditions.push(`m.branch_id = $${i}`); params.push(branchId); i++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [items, countRow] = await Promise.all([
      this.db.queryMany(
        `SELECT m.*,
           json_build_object('id',p.id,'name',p.name,'internalCode',p.internal_code) as product,
           json_build_object('id',b.id,'code',b.code,'name',b.name) as branch,
           json_build_object('id',u.id,'fullName',u.full_name) as creator
         FROM inventory_movements m
         JOIN products p ON m.product_id = p.id
         JOIN branches b ON m.branch_id = b.id
         LEFT JOIN users u ON m.created_by = u.id
         ${where}
         ORDER BY m.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM inventory_movements m ${where}`, params
      ),
    ]);

    const total = parseInt(countRow?.count ?? '0');
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async countInventory(branchId: string, items: Array<{ productId: string; actualQty: number }>, userId: string) {
    const results = [];
    for (const item of items) {
      const inv = await this.db.queryOne(
        'SELECT * FROM inventory WHERE product_id = $1 AND branch_id = $2',
        [item.productId, branchId]
      );
      if (!inv) { results.push({ productId: item.productId, status: 'not_found' }); continue; }
      const diff = item.actualQty - inv.quantity;
      if (diff !== 0) await this.adjustStock(item.productId, branchId, diff, 'Inventory count', userId, 'ADJUSTMENT');
      await this.db.query(
        'UPDATE inventory SET last_counted_at = NOW() WHERE product_id = $1 AND branch_id = $2',
        [item.productId, branchId]
      );
      results.push({ productId: item.productId, before: inv.quantity, after: item.actualQty, diff });
    }
    return results;
  }
}
