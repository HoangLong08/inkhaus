import { ApiProperty } from '@nestjs/swagger';
import {
  CARRIERS,
  TRACKING_NUMBER_MAX,
  TRACKING_NUMBER_PATTERN,
  type CarrierCode,
} from '@inkhaus/shared';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class TrackingDto {
  @ApiProperty({ enum: [...CARRIERS], example: 'UPS' })
  @IsIn(CARRIERS)
  carrier!: CarrierCode;

  @ApiProperty({ example: '1Z999AA10123456784', maxLength: TRACKING_NUMBER_MAX })
  @IsString()
  @MaxLength(TRACKING_NUMBER_MAX)
  @Matches(TRACKING_NUMBER_PATTERN, {
    message: 'number must be 4 to 64 letters, digits, spaces or dashes',
  })
  number!: string;
}
