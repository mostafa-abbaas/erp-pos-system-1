import { IsString, IsUUID, IsArray, IsEnum, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class RefundItemDto {
  @ApiProperty() @IsUUID() saleItemId: string;
  @ApiProperty() @IsInt() @Min(1) quantity: number;
}

export class RefundSaleDto {
  @ApiProperty() @IsString() reason: string;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @ApiProperty({ type: [RefundItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => RefundItemDto) items: RefundItemDto[];
}
