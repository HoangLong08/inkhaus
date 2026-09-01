import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  // `POST /designs` carries the fabric scene plus a mockup data-url per side -
  // express' 100 kB default rejects a design with any real artwork on it as 413.
  // Object storage for previews is the proper fix (see README, "Not built yet").
  app.useBodyParser('json', { limit: process.env.JSON_BODY_LIMIT ?? '12mb' });

  const port = Number(process.env.PORT ?? 4000);
  const prefix = process.env.API_PREFIX ?? 'api';
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:4321')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('INKHAUS API')
    .setDescription('Catalog, design studio, pricing and orders for the INKHAUS storefront.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: `${prefix}/docs/json`,
  });

  await app.listen(port);
  console.log(`INKHAUS API on http://localhost:${port}/${prefix}/v1  (docs: /${prefix}/docs)`);
}

void bootstrap();
