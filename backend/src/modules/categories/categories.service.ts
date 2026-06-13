import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CategoriesService {
  constructor(private db: DatabaseService) {}

  async findAll(query: any) {
    const { search, isActive, page = 1, limit = 50 } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;
    if (search) { conditions.push(`(name ILIKE $${i} OR name_ar ILIKE $${i} OR code ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (isActive !== undefined) { conditions.push(`is_active = $${i}`); params.push(isActive); i++; }
    const offset = (page - 1) * limit;
    const items = await this.db.queryMany(
      `SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.is_active=true) as product_count
       FROM categories c WHERE ${conditions.join(' AND ')} ORDER BY c.name
       LIMIT $${i} OFFSET $${i+1}`, [...params, limit, offset]
    );
    const countRow = await this.db.queryOne<{count:string}>(`SELECT COUNT(*)::int as count FROM categories WHERE ${conditions.join(' AND ')}`, params);
    return { items, total: Number(countRow?.count ?? 0) };
  }

  async create(dto: any) {
    const exists = await this.db.queryOne('SELECT id FROM categories WHERE code=$1', [dto.code]);
    if (exists) throw new ConflictException(`Category code "${dto.code}" already exists`);
    return this.db.queryOne(
      `INSERT INTO categories (code, name, name_ar, parent_id, is_active) VALUES ($1,$2,$3,$4,true) RETURNING *`,
      [dto.code, dto.name, dto.nameAr ?? null, dto.parentId ?? null]
    );
  }

  async update(id: string, dto: any) {
    const exists = await this.db.queryOne('SELECT id FROM categories WHERE id=$1', [id]);
    if (!exists) throw new NotFoundException('Category not found');
    const fields: string[] = []; const params: any[] = []; let i = 1;
    for (const [k, col] of Object.entries({code:'code',name:'name',nameAr:'name_ar',isActive:'is_active',parentId:'parent_id'})) {
      if ((dto as any)[k] !== undefined) { fields.push(`${col}=$${i}`); params.push((dto as any)[k]); i++; }
    }
    if (!fields.length) return exists;
    params.push(id);
    return this.db.queryOne(`UPDATE categories SET ${fields.join(',')}, updated_at=NOW() WHERE id=$${i} RETURNING *`, params);
  }

  async remove(id: string) {
    const inUse = await this.db.queryOne('SELECT id FROM products WHERE category_id=$1 AND is_active=true LIMIT 1', [id]);
    if (inUse) throw new ConflictException('Category is in use by active products');
    return this.db.query('UPDATE categories SET is_active=false WHERE id=$1', [id]);
  }

  // Brands
  async getBrands(query: any) {
    const { search, isActive } = query;
    const conditions: string[] = ['1=1']; const params: any[] = []; let i = 1;
    if (search) { conditions.push(`(name ILIKE $${i} OR name_ar ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (isActive !== undefined) { conditions.push(`is_active=$${i}`); params.push(isActive); i++; }
    return this.db.queryMany(
      `SELECT b.*, (SELECT COUNT(*)::int FROM products p WHERE p.brand_id=b.id AND p.is_active=true) as product_count
       FROM brands b WHERE ${conditions.join(' AND ')} ORDER BY name`, params
    );
  }

  async createBrand(dto: any) {
    const exists = await this.db.queryOne('SELECT id FROM brands WHERE name=$1', [dto.name]);
    if (exists) throw new ConflictException(`Brand "${dto.name}" already exists`);
    return this.db.queryOne(
      `INSERT INTO brands (name, name_ar, is_active) VALUES ($1,$2,true) RETURNING *`,
      [dto.name, dto.nameAr ?? null]
    );
  }

  async updateBrand(id: string, dto: any) {
    const fields: string[] = []; const params: any[] = []; let i = 1;
    for (const [k, col] of Object.entries({name:'name',nameAr:'name_ar',isActive:'is_active'})) {
      if ((dto as any)[k] !== undefined) { fields.push(`${col}=$${i}`); params.push((dto as any)[k]); i++; }
    }
    if (!fields.length) return null;
    params.push(id);
    return this.db.queryOne(`UPDATE brands SET ${fields.join(',')} WHERE id=$${i} RETURNING *`, params);
  }
}
