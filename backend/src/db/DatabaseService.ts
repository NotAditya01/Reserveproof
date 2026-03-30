import { Pool } from 'pg';

import { EncryptedPayload } from '../utils/EncryptedPayload.js';
import { User } from '../services/User.js';

export class DatabaseService {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: 5432 // This is the default port for PostgreSQL
        });
    }

    async initDb() {
        const createUserTableQuery = `
            CREATE TABLE IF NOT EXISTS UserAccount (
                UserID SERIAL PRIMARY KEY,
                Email VARCHAR(255) UNIQUE NOT NULL,
                hashed_password CHAR(60) NOT NULL,
                encrypted_seed JSONB NOT NULL,
                encrypted_state JSONB NOT NULL,
                encrypted_secretkey JSONB NOT NULL
            );
        `;
        const createReserveAttestationsTable = `
            CREATE TABLE IF NOT EXISTS reserve_attestations (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(255) NOT NULL,
                protocol_name VARCHAR(255) NOT NULL,
                total_reserves NUMERIC NOT NULL,
                total_liabilities NUMERIC NOT NULL,
                reserve_ratio NUMERIC NOT NULL,
                solvency_status VARCHAR(16) NOT NULL,
                proof_hash VARCHAR(255),
                verified BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
            );
        `;
        await this.pool.query(createUserTableQuery);
        await this.pool.query(createReserveAttestationsTable);
        await this.pool.query(`ALTER TABLE reserve_attestations ADD COLUMN IF NOT EXISTS category_type VARCHAR(32);`);
        await this.pool.query(`ALTER TABLE reserve_attestations ADD COLUMN IF NOT EXISTS attributes_selected JSONB;`);
        await this.pool.query(`ALTER TABLE reserve_attestations ADD COLUMN IF NOT EXISTS attributes_results JSONB;`);
        await this.pool.query(`ALTER TABLE reserve_attestations ADD COLUMN IF NOT EXISTS overall_verified BOOLEAN;`);
        await this.pool.query(`ALTER TABLE reserve_attestations ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(255);`);
        await this.pool.query(`ALTER TABLE reserve_attestations ADD COLUMN IF NOT EXISTS on_chain BOOLEAN NOT NULL DEFAULT false;`);
        console.log("Table UserAccount initialized.");
    }

    async isRegistered(email: string) {
        const result = await this.queryUserByEmail(email);
        return result.rows.length > 0;
    }

    async createUser(email: string, hashedPsw: string, encryptedSeed: EncryptedPayload,
        encryptedState: EncryptedPayload, encryptedSK: EncryptedPayload) {

        const insertUserQuery = `
            INSERT INTO UserAccount (
                Email, hashed_password, encrypted_seed, encrypted_state, encrypted_secretkey
            ) VALUES ($1, $2, $3, $4, $5);
        `;

        try {
            await this.pool.query(insertUserQuery, [
                email,
                hashedPsw,
                JSON.stringify(encryptedSeed),
                JSON.stringify(encryptedState),
                JSON.stringify(encryptedSK)
            ]);
        } catch (error) {
            if ((error as any).code === '23505') { // Error code 23505 is for unique object exists in db
                throw new Error("Email already exists");
            } else {
                console.log("Error inserting user into db" + error);
                throw error;
            }
        }
    }

    async close() {
        await this.pool.end();
        console.log("Database connection pool closed.");
    }

    async getUserData(email: string) {
        const result = await this.queryUserByEmail(email);

        if (result.rows.length === 0) {
            throw new Error("User not found");
        }

        const userData = {
            userID: result.rows[0].userid,
            email: result.rows[0].email,
            hashedPassword: result.rows[0].hashed_password,
            encryptedSecretKey: result.rows[0].encrypted_secretkey,
            encryptedSeed: result.rows[0].encrypted_seed,
            encryptedState: result.rows[0].encrypted_state
        };

        return userData;
    }

    async getUser(email: string): Promise<User> {
        const userData = await this.getUserData(email);

        const user: User = {
            userID: userData.userID,
            email: userData.email,
            wallet: null
        }
        return user;
    }

    private async queryUserByEmail(email: string) {
        const query = `
        SELECT * FROM UserAccount
        WHERE Email = $1;
    `;
        return await this.pool.query(query, [email]);
    }

    async createReserveAttestation(params: {
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
    }> {
        const query = `
            INSERT INTO reserve_attestations (
                wallet_address,
                protocol_name,
                total_reserves,
                total_liabilities,
                reserve_ratio,
                solvency_status,
                category_type,
                attributes_selected,
                attributes_results,
                overall_verified
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING id, created_at, expires_at;
        `;
        const result = await this.pool.query(query, [
            params.walletAddress,
            params.protocolName,
            params.totalReserves,
            params.totalLiabilities,
            params.reserveRatio,
            params.solvencyStatus,
            params.categoryType ?? null,
            params.attributesSelected ? JSON.stringify(params.attributesSelected) : null,
            params.attributesResults ? JSON.stringify(params.attributesResults) : null,
            params.overallVerified ?? null,
        ]);
        return {
            id: Number(result.rows[0].id),
            createdAt: new Date(result.rows[0].created_at).toISOString(),
            expiresAt: new Date(result.rows[0].expires_at).toISOString(),
        };
    }

    async getReserveAttestationByIdAndWallet(attestationId: number, walletAddress: string): Promise<{
        id: number;
        protocolName: string;
        reserveRatio: number;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        createdAt: string;
        expiresAt: string;
    } | null> {
        const query = `
            SELECT id, protocol_name, reserve_ratio, solvency_status, created_at, expires_at
            FROM reserve_attestations
            WHERE id = $1 AND wallet_address = $2;
        `;
        const result = await this.pool.query(query, [attestationId, walletAddress]);
        if (!result.rows.length) return null;
        return {
            id: Number(result.rows[0].id),
            protocolName: result.rows[0].protocol_name,
            reserveRatio: Number(result.rows[0].reserve_ratio),
            solvencyStatus: result.rows[0].solvency_status,
            createdAt: new Date(result.rows[0].created_at).toISOString(),
            expiresAt: new Date(result.rows[0].expires_at).toISOString(),
        };
    }

    async setReserveAttestationProof(params: {
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
    } | null> {
        const query = `
            UPDATE reserve_attestations
            SET proof_hash = $1, verified = $2, tx_hash = $5, on_chain = $6
            WHERE id = $3 AND wallet_address = $4
            RETURNING protocol_name, solvency_status, created_at, expires_at;
        `;
        const result = await this.pool.query(query, [
            params.proofHash,
            params.verified,
            params.attestationId,
            params.walletAddress,
            params.txHash ?? null,
            params.onChain ?? false,
        ]);
        if (!result.rows.length) return null;
        return {
            protocolName: result.rows[0].protocol_name,
            solvencyStatus: result.rows[0].solvency_status,
            createdAt: new Date(result.rows[0].created_at).toISOString(),
            expiresAt: new Date(result.rows[0].expires_at).toISOString(),
        };
    }

    async getReserveByProofHash(proofHash: string): Promise<{
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
    } | null> {
        const query = `
            SELECT protocol_name, solvency_status, verified, created_at, expires_at, category_type, attributes_results, overall_verified, tx_hash, on_chain
            FROM reserve_attestations
            WHERE proof_hash = $1
            LIMIT 1;
        `;
        const result = await this.pool.query(query, [proofHash]);
        if (!result.rows.length) return null;
        return {
            protocolName: result.rows[0].protocol_name,
            solvencyStatus: result.rows[0].solvency_status,
            verified: Boolean(result.rows[0].verified),
            issuedAt: new Date(result.rows[0].created_at).toISOString(),
            expiresAt: new Date(result.rows[0].expires_at).toISOString(),
            categoryType: result.rows[0].category_type ?? null,
            attributesResults: result.rows[0].attributes_results ?? null,
            overallVerified:
                typeof result.rows[0].overall_verified === 'boolean'
                    ? result.rows[0].overall_verified
                    : null,
            txHash: result.rows[0].tx_hash ?? null,
            onChain: Boolean(result.rows[0].on_chain),
        };
    }

    async getReserveHistoryByWallet(walletAddress: string): Promise<Array<{
        protocolName: string;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        proofHash: string;
        createdAt: string;
    }>> {
        const query = `
            SELECT protocol_name, solvency_status, proof_hash, created_at
            FROM reserve_attestations
            WHERE wallet_address = $1 AND proof_hash IS NOT NULL
            ORDER BY created_at DESC;
        `;
        const result = await this.pool.query(query, [walletAddress]);
        return result.rows.map((row) => ({
            protocolName: row.protocol_name,
            solvencyStatus: row.solvency_status,
            proofHash: row.proof_hash,
            createdAt: new Date(row.created_at).toISOString(),
        }));
    }

    async getReserveFeed(limit = 10): Promise<Array<{
        protocolName: string;
        solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
        createdAt: string;
        proofHash: string;
    }>> {
        const query = `
            SELECT protocol_name, solvency_status, created_at, proof_hash
            FROM reserve_attestations
            WHERE verified = true AND proof_hash IS NOT NULL
            ORDER BY created_at DESC
            LIMIT $1;
        `;
        const result = await this.pool.query(query, [limit]);
        return result.rows.map((row) => ({
            protocolName: row.protocol_name,
            solvencyStatus: row.solvency_status,
            createdAt: new Date(row.created_at).toISOString(),
            proofHash: row.proof_hash,
        }));
    }
}
