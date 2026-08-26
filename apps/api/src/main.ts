import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

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
    .addApiKey({ type: 'apiKey', name: 'x-admin-key', in: 'header' }, 'admin-key')
    .build();
  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: `${prefix}/docs/json`,
  });

  await app.listen(port);
  console.log(`INKHAUS API on http://localhost:${port}/${prefix}/v1  (docs: /${prefix}/docs)`);
}

void bootstrap();
