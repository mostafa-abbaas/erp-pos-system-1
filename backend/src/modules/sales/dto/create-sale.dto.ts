import { IsString, IsUUID, IsArray, IsOptional, IsNumber, IsEnum, ValidateNested, Min, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CREDIT = 'CREDIT',
  MIXED = 'MIXED',
}

export class SaleItemDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsInt() @Min(1) quantity: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() unitPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountPct?: number;
}

export class CreateSaleDto {
  @ApiProperty() @IsUUID() branchId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() shiftId?: string;
  @ApiProperty({ type: [SaleItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => SaleItemDto) items: SaleItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountPct?: number;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) amountPaid?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
