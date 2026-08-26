import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDesignDto {
  @ApiProperty({ example: 'heavyweight-tee' })
  @IsString()
  productSlug!: string;

  @ApiPropertyOptional({ example: 'black', description: 'colour slug the design was built on' })
  @IsOptional()
  @IsString()
  colorSlug?: string;

  @ApiPropertyOptional({ example: 'Team hoodie v2' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({
    description: 'fabric.js scene per side, e.g. { "front": {...}, "back": {...} }',
    type: Object,
  })
  @IsObject()
  scene!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'data-url or storage key of the front mockup' })
  @IsOptional()
  @IsString()
  previewFront?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previewBack?: string;

  @ApiPropertyOptional({ description: 'attach the design to a customer by email' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
