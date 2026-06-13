import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { cors: false });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000');

  // Security
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: [frontendUrl, /^http:\/\/localhost:\d+$/],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  });

  // Global prefix & validation
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP/POS API')
      .setDescription('Home Appliances Spare Parts Store — ERP/POS System API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & Authorization')
      .addTag('products', 'Product Management')
      .addTag('inventory', 'Inventory Management')
      .addTag('sales', 'POS & Sales')
      .addTag('transfers', 'Stock Transfers')
      .addTag('reports', 'Reports & Analytics')
      .addTag('notifications', 'Notifications')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}/api`);
}

bootstrap();
