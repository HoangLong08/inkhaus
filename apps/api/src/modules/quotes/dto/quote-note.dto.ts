import { ApiProperty } from '@nestjs/swagger';
import { QUOTE_NOTE_MAX } from '@inkhaus/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class QuoteNoteDto {
  @ApiProperty({ minLength: 1, maxLength: QUOTE_NOTE_MAX })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'A note cannot be empty.' })
  @MaxLength(QUOTE_NOTE_MAX)
  note!: string;
}
