import { Logger, type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  CHECK_CONSTRAINT_MESSAGES,
  CHECK_VIOLATION_MESSAGE,
  CONCURRENT_WRITE_MESSAGE,
  OUT_OF_RANGE_MESSAGE,
  PrismaExceptionFilter,
} from './prisma-exception.filter';

type Handled = Parameters<PrismaExceptionFilter['catch']>[0];

/** what the filter answered: the status and the JSON body */
function answer(exception: Handled) {
  const json = jest.fn();
  const status = jest.fn<{ json: jest.Mock }, [number]>(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  new PrismaExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

const known = (code: string, meta?: Record<string, unknown>, message = `simulated ${code}`) =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: 'test', meta });

const unknown = (message: string) =>
  new Prisma.PrismaClientUnknownRequestError(message, { clientVersion: 'test' });

const POSTGRES_CHECK =
  'new row for relation "products" violates check constraint "products_bulk_le_price"';

describe('PrismaExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('answers a serialization failure or a deadlock with 409 and "try again"', () => {
    expect(answer(known('P2034'))).toEqual({
      status: 409,
      body: { statusCode: 409, error: 'Conflict', message: CONCURRENT_WRITE_MESSAGE },
    });
  });

  it('answers a value too large for its column with 400', () => {
    expect(answer(known('P2020'))).toEqual({
      status: 400,
      body: { statusCode: 400, error: 'Bad Request', message: OUT_OF_RANGE_MESSAGE },
    });
  });

  it('names the rule a CHECK constraint enforces, whichever shape Prisma reports it in', () => {
    const expected = {
      status: 400,
      body: {
        statusCode: 400,
        error: 'Bad Request',
        message: CHECK_CONSTRAINT_MESSAGES.products_bulk_le_price,
      },
    };

    expect(answer(known('P2004', undefined, `A constraint failed on the database: ${POSTGRES_CHECK}`))).toEqual(
      expected,
    );
    expect(answer(known('P2010', { code: '23514', message: POSTGRES_CHECK }, POSTGRES_CHECK))).toEqual(
      expected,
    );
    expect(answer(unknown(`Error occurred during query execution: ${POSTGRES_CHECK}`))).toEqual(expected);
  });

  it('reads the constraint out of the error a model write really throws', () => {
    // verbatim shape, from `product.update` against the constraint on Postgres 17
    // with Prisma 6: an unknown request error wrapping a debug dump, quotes escaped
    const real = unknown(
      'Invalid `tx.product.update()` invocation:\n\n\nError occurred during query execution:\n' +
        'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { ' +
        'code: "23514", message: "new row for relation \\"products\\" violates check constraint ' +
        '\\"products_bulk_le_price\\"", severity: "ERROR", detail: Some("Failing row contains (...)."), ' +
        'column: None, hint: None }), transient: false })',
    );

    expect(answer(real)).toEqual({
      status: 400,
      body: {
        statusCode: 400,
        error: 'Bad Request',
        message: CHECK_CONSTRAINT_MESSAGES.products_bulk_le_price,
      },
    });
    // the failing row is logged, never sent back
    expect(JSON.stringify(answer(real).body)).not.toContain('Failing row');
  });

  it('still answers 400 for a CHECK constraint it has no sentence for', () => {
    expect(answer(known('P2004', undefined, 'A constraint failed on the database: `x`')).body.message).toBe(
      CHECK_VIOLATION_MESSAGE,
    );
  });

  it('keeps its existing answers', () => {
    expect(answer(known('P2002', { target: ['email'] })).status).toBe(409);
    expect(answer(known('P2025')).status).toBe(404);
    expect(answer(known('P2003')).status).toBe(400);
    expect(answer(new Prisma.PrismaClientValidationError('bad', { clientVersion: 'test' })).status).toBe(400);
  });
});
