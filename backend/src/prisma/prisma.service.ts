import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createMariaDbConnectionConfig, PrismaClient } from '@lingdian/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to initialize Prisma.');
    }

    super({
      adapter: new PrismaMariaDb(createMariaDbConnectionConfig(databaseUrl, {
        requireTls: process.env.DATABASE_MODE === 'external' ||
          (process.env.NODE_ENV === 'production' && process.env.DATABASE_MODE !== 'local'),
      })),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
