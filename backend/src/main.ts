import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { corsOptions } from './common/auth/http-security';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createValidationException } from './common/exceptions/validation.exception';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SystemLogService } from './modules/system-log/system-log.service';
import { isSwaggerEnabled } from './config/swagger.config';
import { createHttpObservabilityMiddleware } from './common/observability/http-observability.middleware';
import { MetricsService } from './modules/metrics/metrics.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  app.set(
    'trust proxy',
    process.env.TRUST_PROXY_HOPS === undefined
      ? 'loopback'
      : Number(process.env.TRUST_PROXY_HOPS),
  );
  const systemLogs = app.get(SystemLogService);
  const metrics = app.get(MetricsService);
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
    etag: true,
    lastModified: true,
    setHeaders(response) {
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(createHttpObservabilityMiddleware(metrics));
  app.enableCors(corsOptions());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: createValidationException,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(systemLogs));

  if (isSwaggerEnabled()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LingDian API Docs')
      .setDescription('LingDian 点餐系统后端接口文档')
      .setVersion('1.0.0')
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: false,
        displayRequestDuration: true,
      },
    });
  }

  const port = Number(process.env.PORT ?? 9000);
  await app.listen(port);
  void systemLogs.record({
    source: 'SERVER',
    level: 'INFO',
    category: 'LIFECYCLE',
    event: 'API_STARTED',
    message: `API process started on port ${port}`,
  }).catch(() => undefined);
  installProcessLogging(app, systemLogs);
}

bootstrap();

function installProcessLogging(
  app: NestExpressApplication,
  systemLogs: SystemLogService,
): void {
  let shuttingDown = false;
  const stop = async (signal: 'SIGINT' | 'SIGTERM') => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forcedExit = setTimeout(() => process.exit(1), 15_000);
    forcedExit.unref();
    try {
      await Promise.race([
        systemLogs.record({
          source: 'SERVER',
          level: 'INFO',
          category: 'LIFECYCLE',
          event: 'API_STOPPING',
          message: `API process received ${signal}`,
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
      ]);
      await app.close();
      clearTimeout(forcedExit);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
  process.once('uncaughtException', (error) => {
    exitAfterLog(systemLogs.record({
      source: 'SERVER',
      level: 'FATAL',
      category: 'LIFECYCLE',
      event: 'PROCESS_UNCAUGHT_EXCEPTION',
      message: error.message,
      details: { errorType: error.name },
    }), 1);
  });
  process.once('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error('Unhandled promise rejection');
    exitAfterLog(systemLogs.record({
      source: 'SERVER',
      level: 'FATAL',
      category: 'LIFECYCLE',
      event: 'PROCESS_UNHANDLED_REJECTION',
      message: error.message,
      details: { errorType: error.name },
    }), 1);
  });
}

function exitAfterLog(write: Promise<void>, exitCode: number): void {
  const timeout = setTimeout(() => process.exit(exitCode), 2_000);
  void write.finally(() => {
    clearTimeout(timeout);
    process.exit(exitCode);
  });
}

export { corsOptions, refreshCookieOptions } from './common/auth/http-security';
