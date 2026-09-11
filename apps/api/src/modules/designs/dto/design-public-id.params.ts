import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * The studio hands out ten characters from a url-safe alphabet; seeded and
 * older ids are longer and carry dashes. Anything outside this is not an id
 * and is refused before it reaches a query.
 */
export const DESIGN_PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{4,40}$/;

/** the `:publicId` in the `admin/designs` routes */
export class DesignPublicIdParamsDto {
  @ApiProperty({ example: 'k3m9xq2t7p', pattern: DESIGN_PUBLIC_ID_PATTERN.source })
  @Matches(DESIGN_PUBLIC_ID_PATTERN, { message: 'publicId must be a design id' })
  publicId!: string;
}
