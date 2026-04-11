import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { WalletManager } from './WalletManager.js';
import { EncryptionService } from '../utils/EncryptionService.js';
import { DatabaseService } from '../db/DatabaseService.js';
import { User } from './User.js';


export class UserAccountManager {
    private static instance: UserAccountManager | null = null;
    private walletManager: WalletManager;
    private encryptionService: EncryptionService;
    private db: DatabaseService;
    private activeSessions: Map<string, User>;
    private sessionTimestamps: Map<string, number>;
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    private constructor() {
        this.walletManager = new WalletManager();
        this.encryptionService = new EncryptionService();
        this.db = new DatabaseService();
        this.activeSessions = new Map();
        this.sessionTimestamps = new Map();

        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const TIMEOUT = 30 * 60 * 1000;  // 30 minutes

            for (const [sessionId, timestamp] of this.sessionTimestamps) {
                if (now - timestamp > TIMEOUT) {
                    this.logout(sessionId).catch(e => console.error("Error during session auto-cleanup:", e));
                }
            }
        }, 5 * 60 * 1000);
    }

    public static getInstance(): UserAccountManager {
        if (!UserAccountManager.instance) {
            UserAccountManager.instance = new UserAccountManager();
        }
        return UserAccountManager.instance;
    }

    public static async cleanup(): Promise<void> {
        if (UserAccountManager.instance) {
            if (UserAccountManager.instance.cleanupInterval) {
                clearInterval(UserAccountManager.instance.cleanupInterval);
            }
            // Close all active wallets
            for (const [, user] of UserAccountManager.instance.activeSessions) {
                if (user.wallet) {
                    await user.wallet.close();
                }
            }
            UserAccountManager.instance.activeSessions.clear();

            // Close database connection
            await UserAccountManager.instance.db.close();
            UserAccountManager.instance = null;
        }
    }

    async signUp(email: string, password: string, confirmPassword: string): Promise<void> {
        email = email.trim().toLowerCase();
        password = password.trim();
        confirmPassword = confirmPassword.trim();

        if (!this.isValidEmailFormat(email)) {
            throw new Error("Invalid email format");
        }

        if (!this.isValidPassword(password)) {
            throw new Error("Password must be at least 8 characters and contain uppercase, lowercase, number, and special character (@$!%*?&)");
        }

        if (password !== confirmPassword) {
            throw new Error("Passwords do not match");
        }

        if (await this.db.isRegistered(email)) {
            throw new Error("Email already exists");
        }

        let wallet: any = null;

        try {
            const { wallet: newWallet, seed } = await this.walletManager.createWalletAndReturnSeed();
            wallet = newWallet;

            const state = wallet.serializeState ? await wallet.serializeState() : '';
            const hashedPassword = await this.hashPassword(password);

            const secretKey = this.generateSecretKey();

            const encryptedSeed = await this.encryptionService.encrypt(seed, secretKey);
            const encryptedState = await this.encryptionService.encrypt(state, secretKey);
            const encryptedSecretKey = await this.encryptionService.encrypt(secretKey, password);

            await this.db.createUser(
                email,
                hashedPassword,
                encryptedSeed,
                encryptedState,
                encryptedSecretKey
            );

            if (wallet?.stop) await wallet.stop();
            else if (wallet?.close) await wallet.close();
        } catch (error) {
            if (wallet) {
                if (wallet.stop) await wallet.stop();
                else if (wallet.close) await wallet.close();
            }
            console.error(`Failed to register user: ${error}`);
            throw error;
        }
    }

    async login(email: string, password: string, sessionId: string): Promise<User> {
        email = email.trim().toLowerCase();
        password = password.trim();

        if (!this.isValidEmailFormat(email)) {
            throw new Error("Invalid email format");
        }

        if (!(await this.db.isRegistered(email))) {
            throw new Error("Email does not exist");
        }

        const userData = await this.db.getUserData(email);

        const isPasswordValid = await bcrypt.compare(password, userData.hashedPassword);
        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }

        const secretKey = await this.encryptionService.decrypt(userData.encryptedSecretKey, password);

        const seed = await this.encryptionService.decrypt(userData.encryptedSeed, secretKey);

        const state = await this.encryptionService.decrypt(userData.encryptedState, secretKey);

        const wallet = await this.walletManager.restoreWallet(seed, state);
        // Wallet is already started by createMidnightWallet

        const user = await this.db.getUser(email);
        user.wallet = wallet;

        this.activeSessions.set(sessionId, user);
        this.sessionTimestamps.set(sessionId, Date.now());

        return user;
    }

    async logout(sessionId: string): Promise<void> {
        const user = this.activeSessions.get(sessionId);

        this.activeSessions.delete(sessionId);
        this.sessionTimestamps.delete(sessionId);

        if (user?.wallet) {
            try {
                await user.wallet.close();
            } catch (error) {
                console.error("Error closing wallet during logout:", error);
            }
        }
    }

    getUser(sessionId: string): User | undefined {
        const lastAccess = this.sessionTimestamps.get(sessionId);
        if (lastAccess && Date.now() - lastAccess > 30 * 60 * 1000) {
            this.logout(sessionId).catch(e => console.error("Error during lazy logout:", e));
            return undefined;
        }

        const user = this.activeSessions.get(sessionId);
        if (user) {
            this.sessionTimestamps.set(sessionId, Date.now());
        }
        return user;
    }

    isLoggedIn(sessionId: string): boolean {
        const lastAccess = this.sessionTimestamps.get(sessionId);
        if (lastAccess && Date.now() - lastAccess > 30 * 60 * 1000) {
            this.logout(sessionId).catch(e => console.error("Error during lazy logout:", e));
            return false;
        }
        return this.activeSessions.has(sessionId);
    }

    private isValidEmailFormat(email: string) {
        return (RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(email));
    }

    private isValidPassword(password: string): boolean {

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }

    private generateSecretKey(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    private hashPassword(password: string) {
        const saltRounds = 10;
        const hashedPassword = bcrypt.hash(password, saltRounds);
        return hashedPassword;
    }
}
