import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * What each CHECK constraint in the migrations means, in the words a 400 should
 * use. A constraint missing from here still answers 400, with a generic line.
 */
export const CHECK_CONSTRAINT_MESSAGES: Record<string, string> = {
  products_bulk_le_price: 'The bulk price cannot be more than the single-unit price.',
};

export const CHECK_VIOLATION_MESSAGE = 'That change breaks a rule the database enforces.';

/** P2034: a serialization failure or a deadlock - nothing was written, and a retry is safe */
export const CONCURRENT_WRITE_MESSAGE =
  'Someone else changed this at the same moment. Reload and try again.';

/** P2020: a number too large for its column, e.g. a total past Decimal(10, 2) */
export const OUT_OF_RANGE_MESSAGE = 'A value is too large to store. Check the numbers and try again.';

/** Postgres' SQLSTATE for a CHECK constraint violation */
const CHECK_VIOLATION = '23514';

/**
 * The constraint a check-violation message names. Postgres says
 * `violates check constraint "products_bulk_le_price"`; Prisma's unknown
 * request error quotes that inside a debug dump, so the quotes arrive escaped
 * (`\"products_bulk_le_price\"`) - both forms match.
 */
function violatedCheck(message: string): string | null {
  return /check constraint \\?"([^"\\]+)\\?"/.exec(message)?.[1] ?? null;
}

function checkViolationMessage(message: string) {
  const constraint = violatedCheck(message);
  return (constraint && CHECK_CONSTRAINT_MESSAGES[constraint]) ?? CHECK_VIOLATION_MESSAGE;
}

/**
 * Prisma reports a CHECK violation in more than one shape depending on the
 * query path: P2004 ("A constraint failed on the database"), P2010 for a raw
 * query carrying SQLSTATE 23514, or an unknown request error whose message
 * quotes the Postgres one. All three are the same refusal.
 */
function isCheckViolation(
  exception:
    | Prisma.PrismaClientKnownRequestError
    | Prisma.PrismaClientUnknownRequestError,
): boolean {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2004') return true;
    if (exception.code === 'P2010') {
      return (exception.meta as { code?: string } | undefined)?.code === CHECK_VIOLATION;
    }
    return false;
  }
  return exception.message.includes(CHECK_VIOLATION) || violatedCheck(exception.message) !== null;
}

type Handled =
  | Prisma.PrismaClientKnownRequestError
  | Prisma.PrismaClientUnknownRequestError
  | Prisma.PrismaClientValidationError;

/**
 * Turns the Prisma error codes we actually hit into HTTP answers instead of a 500.
 * Anything unrecognised falls through to Nest's default handling.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Handled, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const badRequest = (message: string) =>
      res.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, error: 'Bad Request', message });

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn(exception.message);
      return badRequest('Invalid query payload');
    }

    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      if (isCheckViolation(exception)) {
        this.logger.warn(exception.message);
        return badRequest(checkViolationMessage(exception.message));
      }
      this.logger.error('Unhandled Prisma error', exception.stack);
      return super.catch(exception, host);
    }

    if (isCheckViolation(exception)) {
      this.logger.warn(exception.message);
      return badRequest(checkViolationMessage(exception.message));
    }

    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        return res.status(HttpStatus.CONFLICT).json({
          statusCode: 409,
          error: 'Conflict',
          message: `${target} already exists`,
        });
      }
      case 'P2025':
        return res.status(HttpStatus.NOT_FOUND).json({
          statusCode: 404,
          error: 'Not Found',
          message: (exception.meta?.cause as string) ?? 'Record not found',
        });
      case 'P2003':
        return badRequest('Referenced record does not exist');
      case 'P2020':
        this.logger.warn(exception.message);
        return badRequest(OUT_OF_RANGE_MESSAGE);
      // Two transactions that each waited on the other, or a Serializable one
      // that lost. Neither wrote anything, so "try again" is the whole answer.
      // StaffService maps its own P2034 first, with a sentence about staff.
      case 'P2034':
        this.logger.warn(`Write conflict (P2034): ${exception.message}`);
        return res.status(HttpStatus.CONFLICT).json({
          statusCode: 409,
          error: 'Conflict',
          message: CONCURRENT_WRITE_MESSAGE,
        });
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}`, exception.stack);
        return super.catch(exception, host);
    }
  }
}
