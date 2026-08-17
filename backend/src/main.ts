import { ValidationPipe } from '@nestjs/common';
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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const systemLogs = app.get(SystemLogService);
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LingDian API Docs')
    .setDescription('SwiftBite 点餐系统后端接口文档')
    .setVersion('1.0.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  const port = Number(process.env.PORT ?? 9000);
  await app.listen(port);
  void systemLogs.record({
    source: 'SERVER',
    level: 'INFO',
    category: 'LIFECYCLE',
    event: 'API_STARTED',
    message: `API process started on port ${port}`,
  }).catch(() => undefined);
  installProcessLogging(systemLogs);
}

bootstrap();

function installProcessLogging(systemLogs: SystemLogService): void {
  const stop = (signal: 'SIGINT' | 'SIGTERM') => {
    exitAfterLog(systemLogs.record({
      source: 'SERVER',
      level: 'INFO',
      category: 'LIFECYCLE',
      event: 'API_STOPPING',
      message: `API process received ${signal}`,
    }), 0);
  };

  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
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
