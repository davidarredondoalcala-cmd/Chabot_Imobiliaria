import { NestFactory } from '@nestjs/core';
import express from 'express';
import dns from 'dns';
import { AppModule } from './app.module';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const origenes = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((o) =>
      o.includes('*')
        ? new RegExp('^' + o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+') + '$', 'i')
        : o,
    );
  app.enableCors({ origin: origenes.length ? origenes : true });

  app.use(express.json({ limit: '10mb' }));

  await app.listen(process.env.PORT || 4000, '0.0.0.0');
}
bootstrap();