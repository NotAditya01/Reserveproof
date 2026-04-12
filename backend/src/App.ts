import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fs from 'fs';

import { authRouter } from './routes/authRoutes.js';
import { reserveRouter } from './routes/reserveRoutes.js';
import { DatabaseService } from './db/DatabaseService.js';
import { UserAccountManager } from './services/UserAccountManager.js';
import { BackendWalletManager } from './services/BackendWalletManager.js';

const app = express();
const PORT = process.env.PORT || 3000;
const dbService = new DatabaseService();
let isDatabaseReady = false;
let databaseInitAttempts = 0;
let lastDatabaseInitError: string | null = null;

const DATABASE_RETRY_DELAY_MS = Number(process.env.DATABASE_RETRY_DELAY_MS || 15000);

async function initializeDatabaseWithRetry() {
  databaseInitAttempts += 1;
  console.log(`Attempting to initialize database in background (attempt ${databaseInitAttempts})...`);

  try {
    await dbService.initDb();
    isDatabaseReady = true;
    lastDatabaseInitError = null;
    console.log('Database connection successful.');
  } catch (error) {
    isDatabaseReady = false;
    lastDatabaseInitError = error instanceof Error ? error.message : String(error);
    console.error('Database initialization failed.', error);
    console.log(`Retrying database initialization in ${DATABASE_RETRY_DELAY_MS / 1000}s...`);
    setTimeout(() => {
      void initializeDatabaseWithRetry();
    }, DATABASE_RETRY_DELAY_MS);
  }
}

async function startServer() {
  try {
    app.set('trust proxy', 1);

    // Global Middleware Setup
    app.use(express.json()); // Parses JSON bodies

    // Configure CORS to allow cookie-based auth data
    app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    }));

    // Configure session middleware
    app.use(session({
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: 'auto',
        httpOnly: true,
        maxAge: 1000 * 60 * 30 // 30 mins
      }
    }));

    // Create uploads folder if it doesn't exist
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads');
    }

    app.get('/healthz', (_req, res) => {
      return res.status(200).json({
        ok: true,
        databaseReady: isDatabaseReady,
        databaseInitAttempts,
        lastDatabaseInitError,
        walletReady: BackendWalletManager.isReady,
        dustReady: BackendWalletManager.isDustReady,
      });
    });

    app.use('/api', (_req, res, next) => {
      if (!isDatabaseReady) {
        return res.status(503).json({
          error: 'Backend is still initializing the database',
          retryAfterSeconds: Math.max(1, Math.round(DATABASE_RETRY_DELAY_MS / 1000)),
        });
      }
      next();
    });

    // Route Handlers
    app.use('/api/auth', authRouter);
    app.use('/api/reserve', reserveRouter);

    // Server Start first so Azure health checks can pass quickly
    const server = app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });

    void initializeDatabaseWithRetry();

    // Initialize backend wallet in background
    const backendSeed = process.env.BACKEND_WALLET_SEED;
    if (!backendSeed) {
      console.error('FATAL ERROR: BACKEND_WALLET_SEED is missing from environment.');
    } else {
      BackendWalletManager.initialize(backendSeed).catch((err) => {
        console.error('Wallet background initialization failed:', err);
      });
    }

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, closing server gracefully...');
      server.close(async () => {
        await BackendWalletManager.shutdown();
        await UserAccountManager.cleanup();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('\nSIGINT received, closing server gracefully...');
      server.close(async () => {
        await BackendWalletManager.shutdown();
        await UserAccountManager.cleanup();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('FATAL ERROR: Server startup failed.', error);
    process.exit(1);
  }
}

startServer();
