import { EncryptedPayload } from '../utils/EncryptedPayload.js';
import { User } from '../services/User.js';
export declare class DatabaseService {
    private pool;
    constructor();
    initDb(): Promise<void>;
    isRegistered(email: string): Promise<boolean>;
    createUser(email: string, hashedPsw: string, encryptedSeed: EncryptedPayload, encryptedState: EncryptedPayload, encryptedSK: EncryptedPayload): Promise<void>;
    close(): Promise<void>;
    getUserData(email: string): Promise<{
        userID: any;
        email: any;
        hashedPassword: any;
        encryptedSecretKey: any;
        encryptedSeed: any;
        encryptedState: any;
    }>;
    getUser(email: string): Promise<User>;
    private queryUserByEmail;
    createReserveAttestation(params: {
        walletAddress: string;
        protocolName: string;
        totalReserves: number;
        totalLiabilities: number;
        reserveRatio: number;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        categoryType?: string | null;
        attributesSelected?: string[] | null;
        attributesResults?: Record<string, unknown> | null;
        overallVerified?: boolean | null;
    }): Promise<{
        id: number;
        createdAt: string;
        expiresAt: string;
    }>;
    getReserveAttestationByIdAndWallet(attestationId: number, walletAddress: string): Promise<{
        id: number;
        protocolName: string;
        reserveRatio: number;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        createdAt: string;
        expiresAt: string;
    } | null>;
    setReserveAttestationProof(params: {
        attestationId: number;
        walletAddress: string;
        proofHash: string;
        verified: boolean;
        txHash?: string;
        onChain?: boolean;
    }): Promise<{
        protocolName: string;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        createdAt: string;
        expiresAt: string;
    } | null>;
    getReserveByProofHash(proofHash: string): Promise<{
        protocolName: string;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        verified: boolean;
        issuedAt: string;
        expiresAt: string;
        categoryType: string | null;
        attributesResults: Record<string, unknown> | null;
        overallVerified: boolean | null;
        txHash: string | null;
        onChain: boolean;
    } | null>;
    getReserveHistoryByWallet(walletAddress: string): Promise<Array<{
        protocolName: string;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        proofHash: string;
        createdAt: string;
    }>>;
    getReserveHistoryByProtocol(protocolName: string): Promise<Array<{
        proofHash: string;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        categoryType: string | null;
        createdAt: string;
        expiresAt: string;
        onChain: boolean;
        txHash: string | null;
    }>>;
    getReserveFeed(limit?: number): Promise<Array<{
        protocolName: string;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        createdAt: string;
        proofHash: string;
    }>>;
}
//# sourceMappingURL=DatabaseService.d.ts.map