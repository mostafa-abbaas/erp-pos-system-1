import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as dayjs from 'dayjs';

@Injectable()
export class TransfersService {
  constructor(private db: DatabaseService) {}

  async findAll(query: any) {
    const { fromBranchId, toBranchId, status, page = 1, limit = 20 } = query;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;
    if (fromBranchId) { conditions.push(`t.from_branch_id = $${i}`); params.push(fromBranchId); i++; }
    if (toBranchId) { conditions.push(`t.to_branch_id = $${i}`); params.push(toBranchId); i++; }
    if (status) { conditions.push(`t.status = $${i}`); params.push(status); i++; }
    const offset = (page - 1) * limit;
    const items = await this.db.queryMany(
      `SELECT t.*,
         json_build_object('id',fb.id,'code',fb.code,'name',fb.name) as from_branch,
         json_build_object('id',tb.id,'code',tb.code,'name',tb.name) as to_branch,
         json_build_object('id',u.id,'fullName',u.full_name) as requester
       FROM transfers t
       JOIN branches fb ON t.from_branch_id = fb.id
       JOIN branches tb ON t.to_branch_id = tb.id
       JOIN users u ON t.requested_by = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const countRow = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM transfers t WHERE ${conditions.join(' AND ')}`, params
    );
    const total = Number(countRow?.count ?? 0);
    return { items, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const t = await this.db.queryOne(
      `SELECT t.*,
         json_build_object('id',fb.id,'code',fb.code,'name',fb.name) as from_branch,
         json_build_object('id',tb.id,'code',tb.code,'name',tb.name) as to_branch
       FROM transfers t
       JOIN branches fb ON t.from_branch_id = fb.id
       JOIN branches tb ON t.to_branch_id = tb.id
       WHERE t.id = $1`, [id]
    );
    if (!t) throw new NotFoundException('Transfer not found');
    const items = await this.db.queryMany(
      `SELECT ti.*, json_build_object('id',p.id,'name',p.name,'internalCode',p.internal_code) as product
       FROM transfer_items ti JOIN products p ON ti.product_id = p.id WHERE ti.transfer_id = $1`, [id]
    );
    return { ...t, items };
  }

  async create(dto: any, userId: string) {
    if (dto.fromBranchId === dto.toBranchId) throw new BadRequestException('Cannot transfer to same branch');
    const seq = String(Date.now()).slice(-6);
    const number = `TRF-${dayjs().format('YYYYMMDD')}-${seq}`;
    const t = await this.db.queryOne(
      `INSERT INTO transfers (transfer_number, from_branch_id, to_branch_id, requested_by, notes, status)
       VALUES ($1,$2,$3,$4,$5,'PENDING') RETURNING *`,
      [number, dto.fromBranchId, dto.toBranchId, userId, dto.notes || null]
    );
    for (const item of (dto.items || [])) {
      await this.db.query(
        `INSERT INTO transfer_items (transfer_id, product_id, requested_qty) VALUES ($1,$2,$3)`,
        [t.id, item.productId, item.quantity]
      );
    }
    return this.findOne(t.id);
  }

  async updateStatus(id: string, status: string, userId: string) {
    const transfer = await this.findOne(id);
    const validTransitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['COMPLETED'],
    };
    if (!validTransitions[transfer.status]?.includes(status)) {
      throw new BadRequestException(`Cannot move from ${transfer.status} to ${status}`);
    }

    const updates: string[] = [`status = '${status}'`, 'updated_at = NOW()'];
    if (status === 'APPROVED') updates.push(`approved_by = '${userId}'`, 'approved_at = NOW()');
    if (status === 'IN_TRANSIT') updates.push(`dispatched_by = '${userId}'`, 'dispatched_at = NOW()');
    if (status === 'COMPLETED') updates.push(`received_by = '${userId}'`, 'received_at = NOW()');

    await this.db.query(`UPDATE transfers SET ${updates.join(',')} WHERE id = $1`, [id]);

    if (status === 'COMPLETED') {
      await this.db.transaction(async (client) => {
        for (const item of transfer.items) {
          const qty = item.approved_qty ?? item.requested_qty;
          await client.query(
            `UPDATE inventory SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
             WHERE product_id = $2 AND branch_id = $3`,
            [qty, item.product.id, transfer.from_branch_id]
          );
          await client.query(
            `INSERT INTO inventory (product_id, branch_id, quantity) VALUES ($1,$2,$3)
             ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = inventory.quantity + $3, updated_at = NOW()`,
            [item.product.id, transfer.to_branch_id, qty]
          );
        }
      });
    }
    return this.findOne(id);
  }
}
