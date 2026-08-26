import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Turns the Prisma error codes we actually hit into HTTP answers instead of a 500.
 * Anything unrecognised falls through to Nest's default handling.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn(exception.message);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ statusCode: 400, error: 'Bad Request', message: 'Invalid query payload' });
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
        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Referenced record does not exist',
        });
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}`, exception.stack);
        return super.catch(exception, host);
    }
  }
}
