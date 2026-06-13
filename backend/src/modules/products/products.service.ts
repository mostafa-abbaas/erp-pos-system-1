import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import * as ExcelJS from 'exceljs';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateProductDto, userId: string) {
    // Check uniqueness
    if (dto.barcode) {
      const existing = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
      if (existing) throw new ConflictException(`Barcode ${dto.barcode} already exists`);
    }

    const existing = await this.prisma.product.findUnique({ where: { internalCode: dto.internalCode } });
    if (existing) throw new ConflictException(`Internal code ${dto.internalCode} already exists`);

    const product = await this.prisma.product.create({
      data: { ...dto, createdBy: userId },
      include: this.productIncludes(),
    });

    this.eventEmitter.emit('product.created', product);
    return product;
  }

  async findAll(query: ProductQueryDto) {
    const {
      search, categoryId, brandId, supplierId, isActive,
      page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc',
    } = query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameAr: { contains: search, mode: 'insensitive' } },
        { internalCode: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (supplierId) where.supplierId = supplierId;
    if (isActive !== undefined) where.isActive = isActive;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: this.productIncludes(),
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: this.productIncludes(),
    });
    if (!product) throw new NotFoundException(`Product with barcode ${barcode} not found`);
    return product;
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        ...this.productIncludes(),
        inventory: { include: { branch: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto, userId: string) {
    const product = await this.findOne(id);

    if (dto.barcode && dto.barcode !== product.barcode) {
      const existing = await this.prisma.product.findUnique({ where: { barcode: dto.barcode } });
      if (existing) throw new ConflictException(`Barcode ${dto.barcode} already exists`);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: this.productIncludes(),
    });

    this.eventEmitter.emit('product.updated', { old: product, new: updated });
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async importFromExcel(buffer: Buffer, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet(1);
    if (!sheet) throw new BadRequestException('Empty Excel file');

    const results = { success: 0, errors: [] as any[], skipped: 0 };
    const rows: any[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      rows.push({
        rowNumber,
        internalCode: row.getCell(1).text?.trim(),
        barcode: row.getCell(2).text?.trim() || null,
        name: row.getCell(3).text?.trim(),
        nameAr: row.getCell(4).text?.trim() || null,
        categoryCode: row.getCell(5).text?.trim() || null,
        purchasePrice: parseFloat(row.getCell(6).text) || 0,
        sellingPrice: parseFloat(row.getCell(7).text) || 0,
        minStockAlert: parseInt(row.getCell(8).text) || 5,
      });
    });

    for (const row of rows) {
      try {
        if (!row.internalCode || !row.name) {
          results.errors.push({ row: row.rowNumber, error: 'Internal code and name are required' });
          continue;
        }

        const existing = await this.prisma.product.findUnique({ where: { internalCode: row.internalCode } });

        let categoryId: string | undefined;
        if (row.categoryCode) {
          const cat = await this.prisma.category.findUnique({ where: { code: row.categoryCode } });
          categoryId = cat?.id;
        }

        const data = {
          internalCode: row.internalCode,
          barcode: row.barcode || null,
          name: row.name,
          nameAr: row.nameAr,
          categoryId,
          purchasePrice: row.purchasePrice,
          sellingPrice: row.sellingPrice,
          minStockAlert: row.minStockAlert,
          createdBy: userId,
        };

        if (existing) {
          await this.prisma.product.update({ where: { id: existing.id }, data });
          results.skipped++;
        } else {
          await this.prisma.product.create({ data });
          results.success++;
        }
      } catch (err) {
        results.errors.push({ row: row.rowNumber, error: err.message });
      }
    }

    return results;
  }

  async exportToExcel(): Promise<Buffer> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, brand: true, supplier: true },
      orderBy: { internalCode: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');

    sheet.columns = [
      { header: 'Internal Code', key: 'internalCode', width: 20 },
      { header: 'Barcode', key: 'barcode', width: 20 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Name (Arabic)', key: 'nameAr', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Brand', key: 'brand', width: 15 },
      { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
      { header: 'Selling Price', key: 'sellingPrice', width: 15 },
      { header: 'Min Stock Alert', key: 'minStockAlert', width: 15 },
      { header: 'Supplier', key: 'supplier', width: 20 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    products.forEach(p => {
      sheet.addRow({
        internalCode: p.internalCode,
        barcode: p.barcode,
        name: p.name,
        nameAr: p.nameAr,
        category: p.category?.name,
        brand: p.brand?.name,
        purchasePrice: Number(p.purchasePrice),
        sellingPrice: Number(p.sellingPrice),
        minStockAlert: p.minStockAlert,
        supplier: p.supplier?.name,
      });
    });

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  async getLowStockProducts(branchId?: string) {
    const inventory = await this.prisma.inventory.findMany({
      where: {
        ...(branchId && { branchId }),
        product: { isActive: true },
      },
      include: {
        product: { include: { category: true, brand: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    });

    return inventory.filter(inv => inv.quantity <= inv.product.minStockAlert);
  }

  private productIncludes() {
    return {
      category: { select: { id: true, code: true, name: true, nameAr: true } },
      brand: { select: { id: true, name: true, nameAr: true } },
      deviceType: { select: { id: true, name: true, nameAr: true } },
      supplier: { select: { id: true, code: true, name: true } },
    };
  }
}
