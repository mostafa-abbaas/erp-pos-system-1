import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RefundSaleDto } from './dto/refund-sale.dto';
import { SaleQueryDto } from './dto/sale-query.dto';
import { Prisma } from '@prisma/client';
import * as dayjs from 'dayjs';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateSaleDto, cashierId: string) {
    // 1. Validate all items and check stock
    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or inactive');
    }

    // 2. Check inventory for each item
    const inventoryChecks = await this.prisma.inventory.findMany({
      where: {
        productId: { in: productIds },
        branchId: dto.branchId,
      },
    });

    const inventoryMap = new Map(inventoryChecks.map(i => [i.productId, i]));
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of dto.items) {
      const inv = inventoryMap.get(item.productId);
      if (!inv || inv.quantity < item.quantity) {
        const product = productMap.get(item.productId);
        throw new BadRequestException(
          `Insufficient stock for "${product?.name}". Available: ${inv?.quantity ?? 0}`,
        );
      }
    }

    // 3. Calculate totals
    let subtotal = 0;
    const saleItems: Prisma.SaleItemCreateWithoutSaleInput[] = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      const unitPrice = item.unitPrice ?? Number(product.sellingPrice);
      const discountAmount = (unitPrice * item.quantity * (item.discountPct ?? 0)) / 100;
      const taxableAmount = unitPrice * item.quantity - discountAmount;
      const taxRate = Number(product.taxRate);
      const taxAmount = (taxableAmount * taxRate) / 100;
      const total = taxableAmount + taxAmount;

      subtotal += unitPrice * item.quantity;
      saleItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        discountPct: item.discountPct ?? 0,
        discountAmount,
        taxRate,
        taxAmount,
        total,
        costPrice: Number(product.purchasePrice),
      });
    }

    const discountAmount = dto.discountAmount ?? (subtotal * (dto.discountPct ?? 0)) / 100;
    const taxAmount = saleItems.reduce((s, i) => s + Number(i.taxAmount), 0);
    const total = subtotal - discountAmount + taxAmount;
    const changeAmount = Math.max(0, (dto.amountPaid ?? total) - total);

    // 4. Generate invoice number
    const branch = await this.prisma.branch.findUniqueOrThrow({ where: { id: dto.branchId } });
    const todayCount = await this.prisma.sale.count({
      where: { branchId: dto.branchId, createdAt: { gte: dayjs().startOf('day').toDate() } },
    });
    const invoiceNumber = `${branch.code}-${dayjs().format('YYYYMMDD')}-${String(todayCount + 1).padStart(4, '0')}`;

    // 5. Create sale + update inventory in transaction
    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          invoiceNumber,
          branchId: dto.branchId,
          cashierId,
          customerId: dto.customerId,
          subtotal,
          discountAmount,
          discountPct: dto.discountPct ?? 0,
          taxAmount,
          total,
          paymentMethod: dto.paymentMethod,
          amountPaid: dto.amountPaid ?? total,
          changeAmount,
          notes: dto.notes,
          shiftId: dto.shiftId,
          items: { create: saleItems },
        },
        include: { items: { include: { product: true } }, cashier: true, customer: true, branch: true },
      });

      // Update inventory
      for (const item of dto.items) {
        const inv = inventoryMap.get(item.productId)!;
        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { decrement: item.quantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            branchId: dto.branchId,
            type: 'SALE',
            quantity: -item.quantity,
            quantityBefore: inv.quantity,
            quantityAfter: inv.quantity - item.quantity,
            unitCost: productMap.get(item.productId)?.purchasePrice,
            referenceId: created.id,
            referenceType: 'Sale',
            createdBy: cashierId,
          },
        });
      }

      // Update customer totals
      if (dto.customerId) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: { totalPurchases: { increment: total } },
        });
      }

      return created;
    });

    this.eventEmitter.emit('sale.created', sale);
    this.eventEmitter.emit('inventory.check-low-stock', { branchId: dto.branchId });

    return sale;
  }

  async findAll(query: SaleQueryDto) {
    const { branchId, cashierId, customerId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;

    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (cashierId) where.cashierId = cashierId;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cashier: { select: { id: true, fullName: true, username: true } },
          customer: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: { include: { category: true } } } },
        cashier: { select: { id: true, fullName: true, fullNameAr: true } },
        customer: true,
        branch: true,
        refunds: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async refund(id: string, dto: RefundSaleDto, userId: string) {
    const sale = await this.findOne(id);
    if (sale.status === 'REFUNDED') throw new BadRequestException('Sale already fully refunded');
    if (sale.status === 'CANCELLED') throw new BadRequestException('Cannot refund a cancelled sale');

    let refundTotal = 0;
    const refundItems: any[] = [];

    for (const item of dto.items) {
      const saleItem = sale.items.find(i => i.id === item.saleItemId);
      if (!saleItem) throw new BadRequestException(`Sale item ${item.saleItemId} not found`);
      if (item.quantity > saleItem.quantity) throw new BadRequestException('Refund quantity exceeds sold quantity');

      const itemTotal = (Number(saleItem.unitPrice) * item.quantity) * (1 - Number(saleItem.discountPct) / 100);
      refundTotal += itemTotal;
      refundItems.push({ saleItemId: item.saleItemId, quantity: item.quantity, total: itemTotal });
    }

    const refund = await this.prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          saleId: id,
          processedBy: userId,
          reason: dto.reason,
          total: refundTotal,
          paymentMethod: dto.paymentMethod,
          items: { create: refundItems },
        },
      });

      // Return items to inventory
      for (const item of dto.items) {
        const saleItem = sale.items.find(i => i.id === item.saleItemId)!;
        await tx.inventory.upsert({
          where: { productId_branchId: { productId: saleItem.productId, branchId: sale.branchId } },
          update: { quantity: { increment: item.quantity } },
          create: { productId: saleItem.productId, branchId: sale.branchId, quantity: item.quantity },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: saleItem.productId,
            branchId: sale.branchId,
            type: 'RETURN',
            quantity: item.quantity,
            quantityBefore: 0, // Will be calculated separately if needed
            quantityAfter: item.quantity,
            referenceId: created.id,
            referenceType: 'Refund',
            createdBy: userId,
          },
        });
      }

      // Update sale status
      await tx.sale.update({
        where: { id },
        data: { status: 'REFUNDED' },
      });

      return created;
    });

    this.eventEmitter.emit('sale.refunded', { saleId: id, refundId: refund.id });
    return refund;
  }

  async getDailySummary(branchId: string, date?: string) {
    const targetDate = date ? dayjs(date) : dayjs();
    const startOfDay = targetDate.startOf('day').toDate();
    const endOfDay = targetDate.endOf('day').toDate();

    const [sales, returns] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          branchId,
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { total: true, discountAmount: true, taxAmount: true },
        _count: { id: true },
      }),
      this.prisma.refund.aggregate({
        where: {
          sale: { branchId },
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    const paymentBreakdown = await this.prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: {
        branchId,
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    return {
      date: targetDate.format('YYYY-MM-DD'),
      salesCount: sales._count.id,
      salesTotal: Number(sales._sum.total ?? 0),
      discountTotal: Number(sales._sum.discountAmount ?? 0),
      taxTotal: Number(sales._sum.taxAmount ?? 0),
      refundsCount: returns._count.id,
      refundsTotal: Number(returns._sum.total ?? 0),
      netTotal: Number(sales._sum.total ?? 0) - Number(returns._sum.total ?? 0),
      paymentBreakdown,
    };
  }
}
