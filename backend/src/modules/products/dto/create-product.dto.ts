import {
  IsString, IsOptional, IsNumber, IsBoolean, IsArray, MinLength, Min, IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'SP-001' })
  @IsString()
  @MinLength(2)
  internalCode: string;

  @ApiPropertyOptional({ example: '6901234567890' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: 'Motor Start Capacitor 25μF' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'مكثف تشغيل المحرك 25 ميكروفاراد' })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deviceTypeId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compatibleModels?: string[];

  @ApiProperty({ example: 25.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @ApiProperty({ example: 45.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @ApiPropertyOptional({ example: 35.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSellingPrice?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStockAlert?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
