import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { WalletManager } from './WalletManager.js';
import { EncryptionService } from '../utils/EncryptionService.js';
import { DatabaseService } from '../db/DatabaseService.js';
/**
 * UserAccountManager - Singleton service for managing user accounts and sessions
 * Handles multiple concurrent users with session-based wallet management
 */
export class UserAccountManager {
    constructor() {
        this.walletManager = new WalletManager();
        this.encryptionService = new EncryptionService();
        this.db = new DatabaseService();
        this.activeSessions = new Map();
    }
    static getInstance() {
        if (!UserAccountManager.instance) {
            UserAccountManager.instance = new UserAccountManager();
        }
        return UserAccountManager.instance;
    }
    static async cleanup() {
        if (UserAccountManager.instance) {
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
    async signUp(email, password, confirmPassword) {
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
        let wallet = null;
        try {
            const { wallet: newWallet, seed } = await this.walletManager.createWalletAndReturnSeed();
            wallet = newWallet;
            const state = wallet.serializeState ? await wallet.serializeState() : '';
            const hashedPassword = await this.hashPassword(password);
            const secretKey = this.generateSecretKey();
            const encryptedSeed = await this.encryptionService.encrypt(seed, secretKey);
            const encryptedState = await this.encryptionService.encrypt(state, secretKey);
            const encryptedSecretKey = await this.encryptionService.encrypt(secretKey, password);
            await this.db.createUser(email, hashedPassword, encryptedSeed, encryptedState, encryptedSecretKey);
            if (wallet?.stop)
                await wallet.stop();
            else if (wallet?.close)
                await wallet.close();
        }
        catch (error) {
            if (wallet) {
                if (wallet.stop)
                    await wallet.stop();
                else if (wallet.close)
                    await wallet.close();
            }
            console.error(`Failed to register user: ${error}`);
            throw error;
        }
    }
    async login(email, password, sessionId) {
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
        return user;
    }
    async logout(sessionId) {
        const user = this.activeSessions.get(sessionId);
        if (user?.wallet) {
            await user.wallet.close();
        }
        this.activeSessions.delete(sessionId);
    }
    getUser(sessionId) {
        return this.activeSessions.get(sessionId);
    }
    isLoggedIn(sessionId) {
        return this.activeSessions.has(sessionId);
    }
    isValidEmailFormat(email) {
        return (RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(email));
    }
    isValidPassword(password) {
        // Minimum 8 characters, at least one uppercase, one lowercase, one number, and one special character
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }
    generateSecretKey() {
        return crypto.randomBytes(32).toString('hex');
    }
    hashPassword(password) {
        const saltRounds = 10;
        const hashedPassword = bcrypt.hash(password, saltRounds);
        return hashedPassword;
    }
}
UserAccountManager.instance = null;
//# sourceMappingURL=UserAccountManager.js.map