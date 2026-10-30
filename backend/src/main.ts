import { NestFactory } from '@nestjs/core';
import express from 'express';
import dns from 'dns';
import { AppModule } from './app.module';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization',
  });

  app.use(express.json({ limit: '10mb' }));

  await app.listen(process.env.PORT || 4000, '0.0.0.0');
}
bootstrap();