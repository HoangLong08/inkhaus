import { REVIEW_BULK_MAX } from '@inkhaus/shared';
import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus } from '@prisma/client';
import {
  IsEnum,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { bulkIdsError } from '../admin-reviews.rules';

/**
 * The rule lives in admin-reviews.rules.ts, where it is unit tested; this only
 * puts it in front of the handler so a bad selection is a 400 from the
 * ValidationPipe, with the rule's own sentence, before a transaction opens.
 */
@ValidatorConstraint({ name: 'reviewIds' })
class ReviewIdsRule implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return bulkIdsError(value) === null;
  }

  defaultMessage(args: ValidationArguments) {
    return bulkIdsError(args.value) ?? 'ids are not valid.';
  }
}

export class AdminBulkModerateReviewsDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: REVIEW_BULK_MAX,
    uniqueItems: true,
    description: `1 to ${REVIEW_BULK_MAX} review ids, each once`,
  })
  @Validate(ReviewIdsRule)
  ids!: string[];

  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}
