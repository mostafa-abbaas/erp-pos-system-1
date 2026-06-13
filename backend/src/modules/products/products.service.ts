import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ProductsService {
  constructor(private db: DatabaseService) {}

  async findAll(query: any) {
    const { search, categoryId, brandId, supplierId, isActive, page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;

    if (search) {
      conditions.push(`(p.name ILIKE $${i} OR p.name_ar ILIKE $${i} OR p.internal_code ILIKE $${i} OR p.barcode ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }
    if (categoryId) { conditions.push(`p.category_id = $${i}`); params.push(categoryId); i++; }
    if (brandId) { conditions.push(`p.brand_id = $${i}`); params.push(brandId); i++; }
    if (supplierId) { conditions.push(`p.supplier_id = $${i}`); params.push(supplierId); i++; }
    if (isActive !== undefined) { conditions.push(`p.is_active = $${i}`); params.push(isActive); i++; }

    const allowedSort = ['name', 'internal_code', 'selling_price', 'created_at'];
    const safeSort = allowedSort.includes(sortBy) ? sortBy : 'name';
    const safeOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';
    const offset = (page - 1) * limit;

    const countResult = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM products p WHERE ${conditions.join(' AND ')}`, params
    );
    const total = parseInt(countResult?.count ?? '0');

    const items = await this.db.queryMany(
      `SELECT p.*, 
        json_build_object('id', c.id, 'name', c.name, 'nameAr', c.name_ar) as category,
        json_build_object('id', b.id, 'name', b.name) as brand,
        json_build_object('id', s.id, 'name', s.name, 'code', s.code) as supplier
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.${safeSort} ${safeOrder}
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    return { items, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findByBarcode(barcode: string) {
    const product = await this.db.queryOne(
      `SELECT p.*,
        json_build_object('id', c.id, 'name', c.name) as category,
        json_build_object('id', b.id, 'name', b.name) as brand
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE p.barcode = $1`,
      [barcode]
    );
    if (!product) throw new NotFoundException(`Product with barcode ${barcode} not found`);
    return product;
  }

  async findOne(id: string) {
    const product = await this.db.queryOne(
      `SELECT p.*,
        json_build_object('id', c.id, 'name', c.name, 'nameAr', c.name_ar) as category,
        json_build_object('id', b.id, 'name', b.name) as brand,
        json_build_object('id', s.id, 'name', s.name) as supplier
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = $1`,
      [id]
    );
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: any, userId: string) {
    if (dto.barcode) {
      const exists = await this.db.queryOne('SELECT id FROM products WHERE barcode = $1', [dto.barcode]);
      if (exists) throw new ConflictException(`Barcode ${dto.barcode} already exists`);
    }
    const exists = await this.db.queryOne('SELECT id FROM products WHERE internal_code = $1', [dto.internalCode]);
    if (exists) throw new ConflictException(`Internal code ${dto.internalCode} already exists`);

    const result = await this.db.queryOne(
      `INSERT INTO products (internal_code, barcode, name, name_ar, description, category_id, brand_id,
        device_type_id, compatible_models, purchase_price, selling_price, min_selling_price,
        tax_rate, supplier_id, min_stock_alert, notes, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true,$17)
       RETURNING *`,
      [dto.internalCode, dto.barcode || null, dto.name, dto.nameAr || null, dto.description || null,
       dto.categoryId || null, dto.brandId || null, dto.deviceTypeId || null,
       dto.compatibleModels || [], dto.purchasePrice || 0, dto.sellingPrice || 0,
       dto.minSellingPrice || null, dto.taxRate || 0, dto.supplierId || null,
       dto.minStockAlert || 5, dto.notes || null, userId]
    );
    return result;
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;

    const mapping: Record<string, string> = {
      internalCode: 'internal_code', barcode: 'barcode', name: 'name', nameAr: 'name_ar',
      description: 'description', categoryId: 'category_id', brandId: 'brand_id',
      purchasePrice: 'purchase_price', sellingPrice: 'selling_price',
      minSellingPrice: 'min_selling_price', taxRate: 'tax_rate', supplierId: 'supplier_id',
      minStockAlert: 'min_stock_alert', notes: 'notes', isActive: 'is_active',
    };

    for (const [key, col] of Object.entries(mapping)) {
      if (dto[key] !== undefined) { fields.push(`${col} = $${i}`); params.push(dto[key]); i++; }
    }
    if (fields.length === 0) return this.findOne(id);

    params.push(id);
    return this.db.queryOne(
      `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      params
    );
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.db.query('UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  }

  async getLowStock(branchId?: string) {
    const branchFilter = branchId ? 'AND i.branch_id = $1' : '';
    const params = branchId ? [branchId] : [];
    return this.db.queryMany(
      `SELECT i.*, p.name, p.name_ar, p.internal_code, p.min_stock_alert,
              json_build_object('id', b.id, 'code', b.code, 'name', b.name) as branch
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       JOIN branches b ON i.branch_id = b.id
       WHERE p.is_active = true AND i.quantity <= p.min_stock_alert ${branchFilter}
       ORDER BY i.quantity ASC`,
      params
    );
  }

  async getCategories() {
    return this.db.queryMany('SELECT * FROM categories WHERE is_active = true ORDER BY name');
  }

  async getBrands() {
    return this.db.queryMany('SELECT * FROM brands WHERE is_active = true ORDER BY name');
  }

  async getSuppliers() {
    return this.db.queryMany('SELECT * FROM suppliers WHERE is_active = true ORDER BY name');
  }

  async importFromExcel(buffer: Buffer, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet(1);
    if (!sheet) throw new BadRequestException('Empty Excel file');

    const results = { success: 0, updated: 0, errors: [] as any[] };

    const rows: any[] = [];
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      rows.push({
        n,
        internalCode: String(row.getCell(1).value || '').trim(),
        barcode: String(row.getCell(2).value || '').trim() || null,
        name: String(row.getCell(3).value || '').trim(),
        nameAr: String(row.getCell(4).value || '').trim() || null,
        categoryCode: String(row.getCell(5).value || '').trim() || null,
        purchasePrice: parseFloat(String(row.getCell(6).value || '0')) || 0,
        sellingPrice: parseFloat(String(row.getCell(7).value || '0')) || 0,
        minStockAlert: parseInt(String(row.getCell(8).value || '5')) || 5,
      });
    });

    for (const row of rows) {
      try {
        if (!row.internalCode || !row.name) {
          results.errors.push({ row: row.n, error: 'Internal code and name are required' });
          continue;
        }
        let categoryId: string | null = null;
        if (row.categoryCode) {
          const cat = await this.db.queryOne('SELECT id FROM categories WHERE code = $1', [row.categoryCode]);
          categoryId = cat?.id || null;
        }
        const existing = await this.db.queryOne('SELECT id FROM products WHERE internal_code = $1', [row.internalCode]);
        if (existing) {
          await this.db.query(
            `UPDATE products SET name=$1, name_ar=$2, barcode=$3, category_id=$4, purchase_price=$5, selling_price=$6, min_stock_alert=$7, updated_at=NOW() WHERE id=$8`,
            [row.name, row.nameAr, row.barcode, categoryId, row.purchasePrice, row.sellingPrice, row.minStockAlert, existing.id]
          );
          results.updated++;
        } else {
          await this.db.query(
            `INSERT INTO products (internal_code, barcode, name, name_ar, category_id, purchase_price, selling_price, min_stock_alert, created_by, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
            [row.internalCode, row.barcode, row.name, row.nameAr, categoryId, row.purchasePrice, row.sellingPrice, row.minStockAlert, userId]
          );
          results.success++;
        }
      } catch (e: any) {
        results.errors.push({ row: row.n, error: e.message });
      }
    }
    return results;
  }

  async exportToExcel(): Promise<any> {
    const products = await this.db.queryMany(
      `SELECT p.*, c.name as category_name, b.name as brand_name, s.name as supplier_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.is_active = true ORDER BY p.internal_code`
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    ws.columns = [
      { header: 'Internal Code', key: 'internal_code', width: 18 },
      { header: 'Barcode', key: 'barcode', width: 18 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Name (Arabic)', key: 'name_ar', width: 30 },
      { header: 'Category', key: 'category_name', width: 18 },
      { header: 'Brand', key: 'brand_name', width: 15 },
      { header: 'Purchase Price', key: 'purchase_price', width: 14 },
      { header: 'Selling Price', key: 'selling_price', width: 14 },
      { header: 'Min Stock Alert', key: 'min_stock_alert', width: 14 },
      { header: 'Supplier', key: 'supplier_name', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    products.forEach(p => ws.addRow(p));
    return wb.xlsx.writeBuffer() as Promise<any>;
  }
}
