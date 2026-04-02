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
async function startServer() {
    try {
        // Initialize Database (Must complete before server starts)
        console.log('🔗 Attempting to initialize database...');
        await dbService.initDb();
        console.log('✅ Database connection successful!');
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
                secure: false, // Set to true in production with HTTPS
                httpOnly: true,
                maxAge: 1000 * 60 * 30 // 30 mins
            }
        }));
        // Create uploads folder if it doesn't exist
        if (!fs.existsSync('./uploads')) {
            fs.mkdirSync('./uploads');
        }
        // Route Handlers
        app.use('/api/auth', authRouter);
        app.use('/api/reserve', reserveRouter);
        // Initialize Persistent Backend Wallet (Waits for full sync)
        const backendSeed = process.env.BACKEND_WALLET_SEED;
        if (!backendSeed) {
            console.error('❌ FATAL ERROR: BACKEND_WALLET_SEED is missing from environment.');
            process.exit(1);
        }
        await BackendWalletManager.initialize(backendSeed);
        // Server Start (Only runs if DB & Wallet connection succeeded)
        const server = app.listen(PORT, () => {
            console.log(`⚡️ Server is running at http://localhost:${PORT}`);
        });
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
    }
    catch (error) {
        console.error('❌ FATAL ERROR: Server startup failed.', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=App.js.map