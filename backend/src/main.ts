import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const production = process.env.NODE_ENV === 'production';

  // Where the website lives (comma-separated if more than one).
  const frontendUrls = (process.env.FRONTEND_URL ?? 'http://localhost:3001')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  // Behind nginx in production: trust it so secure cookies work over HTTPS.
  if (production) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET is missing from .env');
  }

  const sessionPool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const PgSession = connectPgSimple(session);

  app.enableCors({
    origin: frontendUrls,
    credentials: true,
  });

  app.use(
    session({
      store: new PgSession({
        pool: sessionPool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: production,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
app.use(passport.initialize());
app.use(passport.session());
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();