import { ApiProperty } from '@nestjs/swagger';
import { ORDER_INTERNAL_NOTE_MAX } from '@inkhaus/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddOrderNoteDto {
  @ApiProperty({
    description: 'staff only - never shown to the customer',
    maxLength: ORDER_INTERNAL_NOTE_MAX,
  })
  // trimmed before the checks, so a note of nothing but spaces is empty rather
  // than a blank line on the timeline
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'note must not be empty' })
  @MaxLength(ORDER_INTERNAL_NOTE_MAX)
  note!: string;
}
