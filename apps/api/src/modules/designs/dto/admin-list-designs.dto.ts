import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** `GET /admin/designs?customerId=` */
export class AdminListDesignsDto {
  @ApiProperty({ description: "the customer whose saved designs to list - a customer id, not an email" })
  @Matches(/^[A-Za-z0-9_-]{1,64}$/, { message: 'customerId must be a customer id' })
  customerId!: string;
}
