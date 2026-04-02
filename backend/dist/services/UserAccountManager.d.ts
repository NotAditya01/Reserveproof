import { User } from './User.js';
/**
 * UserAccountManager - Singleton service for managing user accounts and sessions
 * Handles multiple concurrent users with session-based wallet management
 */
export declare class UserAccountManager {
    private static instance;
    private walletManager;
    private encryptionService;
    private db;
    private activeSessions;
    private constructor();
    static getInstance(): UserAccountManager;
    static cleanup(): Promise<void>;
    signUp(email: string, password: string, confirmPassword: string): Promise<void>;
    login(email: string, password: string, sessionId: string): Promise<User>;
    logout(sessionId: string): Promise<void>;
    getUser(sessionId: string): User | undefined;
    isLoggedIn(sessionId: string): boolean;
    private isValidEmailFormat;
    private isValidPassword;
    private generateSecretKey;
    private hashPassword;
}
//# sourceMappingURL=UserAccountManager.d.ts.map