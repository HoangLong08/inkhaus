import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/**
 * A real JSON boolean, or a 400.
 *
 * The global ValidationPipe enables implicit conversion, which turns the
 * string "false" into `Boolean("false")` - true - before any validator runs.
 * On a flag like `active` that makes a hand-made "archive this" un-archive it
 * instead. The transform hands the validator the raw value from the body, so
 * `"false"`, `0` and `"no"` are refused rather than read as anything.
 */
export function RawBoolean() {
  return applyDecorators(
    Transform(({ obj, key }) => (obj as Record<string, unknown>)[key]),
    IsBoolean(),
  );
}
