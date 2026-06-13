import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getStock(branchId?: string, productId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (productId) where.productId = productId;

    return this.prisma.inventory.findMany({
      where,
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, nameAr: true } },
            brand: { select: { id: true, name: true } },
          },
        },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ branch: { code: 'asc' } }, { product: { name: 'asc' } }],
    });
  }

  async adjustStock(
    productId: string,
    branchId: string,
    quantity: number,
    notes: string,
    userId: string,
    type: 'ADJUSTMENT' | 'DAMAGE' | 'INITIAL' = 'ADJUSTMENT',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventory.upsert({
        where: { productId_branchId: { productId, branchId } },
        create: { productId, branchId, quantity: 0 },
        update: {},
      });

      const newQty = current.quantity + quantity;
      if (newQty < 0) throw new BadRequestException('Stock cannot go below zero');

      const updated = await tx.inventory.update({
        where: { id: current.id },
        data: { quantity: newQty },
      });

      await tx.inventoryMovement.create({
        data: {
          productId,
          branchId,
          type,
          quantity,
          quantityBefore: current.quantity,
          quantityAfter: newQty,
          notes,
          createdBy: userId,
        },
      });

      return updated;
    });
  }

  async getMovements(productId?: string, branchId?: string, page = 1, limit = 50) {
    const where: any = {};
    if (productId) where.productId = productId;
    if (branchId) where.branchId = branchId;

    const [items, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, nameAr: true, internalCode: true } },
          branch: { select: { id: true, code: true, name: true } },
          creator: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async countInventory(branchId: string, items: Array<{ productId: string; actualQty: number }>, userId: string) {
    const results = [];
    for (const item of items) {
      const current = await this.prisma.inventory.findUnique({
        where: { productId_branchId: { productId: item.productId, branchId } },
      });

      if (!current) {
        results.push({ productId: item.productId, status: 'not_found' });
        continue;
      }

      const diff = item.actualQty - current.quantity;
      if (diff !== 0) {
        await this.adjustStock(item.productId, branchId, diff, 'Inventory count adjustment', userId, 'ADJUSTMENT');
      }

      await this.prisma.inventory.update({
        where: { id: current.id },
        data: { lastCountedAt: new Date() },
      });

      results.push({ productId: item.productId, before: current.quantity, after: item.actualQty, diff });
    }
    return results;
  }

  @OnEvent('inventory.check-low-stock')
  async checkLowStock(payload: { branchId: string }) {
    const lowStock = await this.prisma.inventory.findMany({
      where: {
        branchId: payload.branchId,
        product: { isActive: true },
      },
      include: { product: true, branch: true },
    });

    for (const inv of lowStock) {
      if (inv.quantity <= inv.product.minStockAlert) {
        // Check if notification already exists in last 24h to avoid spam
        const existing = await this.prisma.notification.findFirst({
          where: {
            type: 'LOW_STOCK',
            referenceId: inv.productId,
            branchId: payload.branchId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        if (!existing) {
          await this.prisma.notification.create({
            data: {
              type: 'LOW_STOCK',
              title: `Low Stock Alert: ${inv.product.name}`,
              titleAr: `تنبيه مخزون منخفض: ${inv.product.nameAr ?? inv.product.name}`,
              message: `Product "${inv.product.name}" has only ${inv.quantity} units left (minimum: ${inv.product.minStockAlert})`,
              messageAr: `المنتج "${inv.product.nameAr ?? inv.product.name}" لديه ${inv.quantity} وحدة فقط (الحد الأدنى: ${inv.product.minStockAlert})`,
              branchId: payload.branchId,
              referenceId: inv.productId,
              referenceType: 'Product',
            },
          });

          this.eventEmitter.emit('notification.created', { branchId: payload.branchId });
        }
      }
    }
  }
}
