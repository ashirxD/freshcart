import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { AppConfig } from './common/config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Trust the reverse proxy so rate limiting sees real client IPs in production.
    bufferLogs: true,
  });

  const configService = app.get(ConfigService<AppConfig, true>);
  const port = configService.get('port', { infer: true });
  const apiPrefix = configService.get('apiPrefix', { infer: true });
  const corsOrigins = configService.get('corsOrigins', { infer: true });
  const isProduction = configService.get('isProduction', { infer: true });

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      // Product photography is served from this origin and rendered by the web
      // client on another. The default `same-origin` policy would make the
      // browser refuse to paint those images.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  /**
   * Uploaded product photography.
   *
   * Served from the API rather than proxied through Next, because the files are
   * written by this process and nothing is gained by a second hop. Registered
   * BEFORE the global prefix is set, and with its own prefix, so the URLs are
   * `/media/<key>` rather than `/api/v1/media/<key>` — an image URL is stored on
   * a product document and must not move when the API version does.
   *
   * `index: false` so the directory is never listed, and `dotfiles: 'deny'` so
   * nothing beginning with a dot is reachable even if one is somehow written.
   */
  const media = configService.get('media', { infer: true });

  app.useStaticAssets(resolve(media.storageDir), {
    prefix: media.publicPath,
    index: false,
    dotfiles: 'deny',
    // Content-addressed names, so a stored image never changes under its URL.
    maxAge: '30d',
    immutable: true,
  });

  // Health probes stay off the versioned prefix so infrastructure can hit /health.
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });

  app.enableCors({
    // Production is a strict allowlist. Development additionally accepts any
    // localhost origin, because dev servers get whatever port is free and
    // chasing that in configuration is friction with no security value —
    // an attacker cannot serve a page from the developer's own machine.
    origin: isProduction ? corsOrigins : buildDevOriginCheck(corsOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties, then reject the request if any were sent.
      // This is what stops a client from smuggling `role` into a register call.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log('FreshCarts API listening on http://localhost:' + port + '/' + apiPrefix);
  logger.log('Health check: http://localhost:' + port + '/health');
}

/**
 * Development origin check: the configured allowlist, plus any port on
 * localhost. Returns a callback rather than a wildcard so `credentials: true`
 * still works — `Access-Control-Allow-Origin: *` is rejected with credentials.
 */
function buildDevOriginCheck(allowed: string[]) {
  const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    // Same-origin and non-browser callers (curl, tests) send no Origin header.
    if (!origin) return callback(null, true);
    if (allowed.includes(origin) || LOCALHOST.test(origin)) return callback(null, true);
    return callback(null, false);
  };
}

void bootstrap();
