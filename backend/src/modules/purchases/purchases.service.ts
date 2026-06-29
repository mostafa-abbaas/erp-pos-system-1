import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as dayjs from 'dayjs';

@Injectable()
export class PurchasesService {
  constructor(private db: DatabaseService) {}

  async findAll(query: any) {
    const { branchId, supplierId, dateFrom, dateTo, page = 1, limit = 20 } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (branchId) { conditions.push(`p.branch_id = $${i}`); params.push(branchId); i++; }
    if (supplierId) { conditions.push(`p.supplier_id = $${i}`); params.push(supplierId); i++; }
    if (dateFrom) { conditions.push(`p.created_at >= $${i}`); params.push(dateFrom); i++; }
    if (dateTo) { conditions.push(`p.created_at <= $${i}`); params.push(dateTo); i++; }

    const offset = (page - 1) * limit;
    const where = conditions.join(' AND ');

    const [items, countRow] = await Promise.all([
      this.db.queryMany(
        `SELECT p.*,
           json_build_object('id',s.id,'code',s.code,'name',s.name) as supplier,
           json_build_object('id',b.id,'code',b.code,'name',b.name) as branch,
           json_build_object('id',u.id,'fullName',u.full_name) as receiver,
           (SELECT COUNT(*)::int FROM purchase_items pi WHERE pi.purchase_id = p.id) as item_count
         FROM purchases p
         JOIN suppliers s ON p.supplier_id = s.id
         JOIN branches b ON p.branch_id = b.id
         LEFT JOIN users u ON p.received_by = u.id
         WHERE ${where}
         ORDER BY p.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      this.db.queryOne<{ count: string }>(`SELECT COUNT(*)::int as count FROM purchases p WHERE ${where}`, params),
    ]);

    const total = Number(countRow?.count ?? 0);
    return { items, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const purchase = await this.db.queryOne(
      `SELECT p.*,
         json_build_object('id',s.id,'code',s.code,'name',s.name,'phone',s.phone) as supplier,
         json_build_object('id',b.id,'code',b.code,'name',b.name) as branch,
         json_build_object('id',u.id,'fullName',u.full_name) as receiver
       FROM purchases p
       JOIN suppliers s ON p.supplier_id = s.id
       JOIN branches b ON p.branch_id = b.id
       LEFT JOIN users u ON p.received_by = u.id
       WHERE p.id = $1`, [id]
    );
    if (!purchase) throw new NotFoundException('Purchase not found');

    const items = await this.db.queryMany(
      `SELECT pi.*,
         json_build_object('id',pr.id,'name',pr.name,'nameAr',pr.name_ar,'internalCode',pr.internal_code,'barcode',pr.barcode) as product
       FROM purchase_items pi
       JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = $1`, [id]
    );

    return { ...purchase, items };
  }

  async create(dto: any, userId: string) {
    if (!dto.branchId) throw new BadRequestException('branchId is required to create a purchase');
    if (!dto.supplierId) throw new BadRequestException('supplierId is required to create a purchase');
    if (!Array.isArray(dto.items) || dto.items.length === 0) throw new BadRequestException('At least one item is required');

    const supplier = await this.db.queryOne('SELECT * FROM suppliers WHERE id = $1', [dto.supplierId]);
    if (!supplier) throw new NotFoundException('Supplier not found');

    // Calculate totals
    let subtotal = 0;
    const lineItems: any[] = [];

    for (const item of dto.items) {
      const product = await this.db.queryOne('SELECT * FROM products WHERE id = $1', [item.productId]);
      if (!product) throw new BadRequestException(`Product ${item.productId} not found`);
      const total = item.unitCost * item.quantity;
      subtotal += total;
      lineItems.push({ ...item, total });
    }

    const discountAmount = dto.discountAmount ?? 0;
    const taxAmount = dto.taxAmount ?? 0;
    const total = subtotal - discountAmount + taxAmount;

    // Generate purchase number
    const seq = String(Date.now()).slice(-6);
    const purchaseNumber = `PUR-${dayjs().format('YYYYMMDD')}-${seq}`;

    return this.db.transaction(async (client) => {
      const purchase = await client.query(
        `INSERT INTO purchases (purchase_number, branch_id, supplier_id, received_by, subtotal,
           discount_amount, tax_amount, total, amount_paid, notes, invoice_ref, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [purchaseNumber, dto.branchId, dto.supplierId, userId, subtotal,
         discountAmount, taxAmount, total, dto.amountPaid ?? 0,
         dto.notes ?? null, dto.invoiceRef ?? null, new Date()]
      );
      const pur = purchase.rows[0];

      for (const item of lineItems) {
        await client.query(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, total)
           VALUES ($1,$2,$3,$4,$5)`,
          [pur.id, item.productId, item.quantity, item.unitCost, item.total]
        );

        // Update inventory - upsert
        await client.query(
          `INSERT INTO inventory (product_id, branch_id, quantity)
           VALUES ($1,$2,$3)
           ON CONFLICT (product_id, branch_id)
           DO UPDATE SET quantity = inventory.quantity + $3, updated_at = NOW()`,
          [item.productId, dto.branchId, item.quantity]
        );

        // Update product purchase price
        await client.query(
          `UPDATE products SET purchase_price = $1, updated_at = NOW() WHERE id = $2`,
          [item.unitCost, item.productId]
        );

        // Log movement
        const invRow = await client.query(
          'SELECT quantity FROM inventory WHERE product_id=$1 AND branch_id=$2',
          [item.productId, dto.branchId]
        );
        const currentQty = invRow.rows[0]?.quantity ?? item.quantity;
        await client.query(
          `INSERT INTO inventory_movements (product_id, branch_id, type, quantity, quantity_before, quantity_after, unit_cost, reference_id, reference_type, created_by)
           VALUES ($1,$2,'PURCHASE',$3,$4,$5,$6,$7,'Purchase',$8)`,
          [item.productId, dto.branchId, item.quantity, currentQty - item.quantity, currentQty, item.unitCost, pur.id, userId]
        );
      }

      // Update supplier balance
      const amountOwed = total - (dto.amountPaid ?? 0);
      if (amountOwed > 0) {
        await client.query(
          'UPDATE suppliers SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [amountOwed, dto.supplierId]
        );
      }

      return pur;
    });
  }

  async getSuppliers(query: any) {
    const { search, isActive, page = 1, limit = 20 } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (search) {
      conditions.push(`(name ILIKE $${i} OR name_ar ILIKE $${i} OR code ILIKE $${i} OR phone ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }
    if (isActive !== undefined) { conditions.push(`is_active = $${i}`); params.push(isActive); i++; }

    const offset = (page - 1) * limit;
    const where = conditions.join(' AND ');

    const [items, countRow] = await Promise.all([
      this.db.queryMany(
        `SELECT s.*, 
           (SELECT COUNT(*)::int FROM purchases p WHERE p.supplier_id = s.id) as purchase_count,
           (SELECT COALESCE(SUM(total),0) FROM purchases p WHERE p.supplier_id = s.id) as total_purchased
         FROM suppliers s WHERE ${where}
         ORDER BY name LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      this.db.queryOne<{ count: string }>(`SELECT COUNT(*)::int as count FROM suppliers WHERE ${where}`, params),
    ]);

    return { items, total: Number(countRow?.count ?? 0), page: +page, limit: +limit, totalPages: Math.ceil(Number(countRow?.count ?? 0) / limit) };
  }

  async createSupplier(dto: any) {
    const exists = await this.db.queryOne('SELECT id FROM suppliers WHERE code=$1', [dto.code]);
    if (exists) throw new BadRequestException(`Supplier code ${dto.code} already exists`);
    return this.db.queryOne(
      `INSERT INTO suppliers (code, name, name_ar, contact, phone, email, address, tax_number, notes, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
      [dto.code, dto.name, dto.nameAr ?? null, dto.contact ?? null, dto.phone ?? null,
       dto.email ?? null, dto.address ?? null, dto.taxNumber ?? null, dto.notes ?? null]
    );
  }

  async updateSupplier(id: string, dto: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    const map: Record<string, string> = {
      name: 'name', nameAr: 'name_ar', contact: 'contact', phone: 'phone',
      email: 'email', address: 'address', taxNumber: 'tax_number', notes: 'notes', isActive: 'is_active',
    };
    for (const [k, col] of Object.entries(map)) {
      if (dto[k] !== undefined) { fields.push(`${col}=$${i}`); params.push(dto[k]); i++; }
    }
    if (!fields.length) return this.db.queryOne('SELECT * FROM suppliers WHERE id=$1', [id]);
    params.push(id);
    return this.db.queryOne(`UPDATE suppliers SET ${fields.join(',')}, updated_at=NOW() WHERE id=$${i} RETURNING *`, params);
  }

 async getPurchaseReport(params: any) {
  const { branchId, supplierId, dateFrom, dateTo } = params;
  const conditions: string[] = [];
  const qParams: any[] = [];
  let i = 1;

    if (branchId) { conditions.push(`p.branch_id=$${i}`); qParams.push(branchId); i++; }
    if (supplierId) { conditions.push(`p.supplier_id=$${i}`); qParams.push(supplierId); i++; }
    if (dateFrom) { conditions.push(`p.created_at>=$${i}`); qParams.push(dateFrom); i++; }
    if (dateTo) { conditions.push(`p.created_at<=$${i}`); qParams.push(dateTo); i++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [summary, bySupplier] = await Promise.all([
      this.db.queryOne(
        `SELECT COUNT(p.id)::int as count, COALESCE(SUM(p.total),0) as total,
                COALESCE(SUM(p.amount_paid),0) as paid,
                COALESCE(SUM(p.total - p.amount_paid),0) as outstanding
         FROM purchases p ${where}`, qParams
      ),
      this.db.queryMany(
        `SELECT s.name, s.code, COUNT(p.id)::int as orders,
                COALESCE(SUM(p.total),0) as total, s.balance
         FROM purchases p
         JOIN suppliers s ON p.supplier_id = s.id
         ${where}
         GROUP BY s.id, s.name, s.code, s.balance
         ORDER BY total DESC`, qParams
      ),
    ]);

    return { summary, bySupplier };
  }
}
