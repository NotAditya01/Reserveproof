import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
export declare const CONFIG: {
    indexer: string;
    indexerWS: string;
    node: string;
    proofServer: string;
};
export declare const zkConfigPath: string;
export declare function loadContractModule(): Promise<any>;
export declare function deriveKeys(seed: string): Record<0 | 2 | 3, Uint8Array<ArrayBufferLike>>;
export declare function createMidnightWallet(seed: string): Promise<{
    wallet: WalletFacade;
    shieldedSecretKeys: ledger.ZswapSecretKeys;
    dustSecretKey: ledger.DustSecretKey;
    unshieldedKeystore: import("@midnight-ntwrk/wallet-sdk-unshielded-wallet").UnshieldedKeystore;
}>;
export declare function signTransactionIntents(tx: {
    intents?: Map<number, any>;
}, signFn: (payload: Uint8Array) => ledger.Signature, proofMarker: 'proof' | 'pre-proof'): void;
export declare function createProviders(walletCtx: Awaited<ReturnType<typeof createMidnightWallet>>): Promise<{
    privateStateProvider: import("@midnight-ntwrk/midnight-js-types").PrivateStateProvider<string, any> & {
        invalidateEncryptionCache(): void;
        changePassword(oldPasswordProvider: import("@midnight-ntwrk/midnight-js-level-private-state-provider").PrivateStoragePasswordProvider, newPasswordProvider: import("@midnight-ntwrk/midnight-js-level-private-state-provider").PrivateStoragePasswordProvider, options?: import("@midnight-ntwrk/midnight-js-level-private-state-provider").PasswordRotationOptions): Promise<import("@midnight-ntwrk/midnight-js-level-private-state-provider").PasswordRotationResult>;
        changeSigningKeysPassword(oldPasswordProvider: import("@midnight-ntwrk/midnight-js-level-private-state-provider").PrivateStoragePasswordProvider, newPasswordProvider: import("@midnight-ntwrk/midnight-js-level-private-state-provider").PrivateStoragePasswordProvider, options?: import("@midnight-ntwrk/midnight-js-level-private-state-provider").PasswordRotationOptions): Promise<import("@midnight-ntwrk/midnight-js-level-private-state-provider").PasswordRotationResult>;
    };
    publicDataProvider: import("@midnight-ntwrk/midnight-js-types").PublicDataProvider;
    zkConfigProvider: NodeZkConfigProvider<string>;
    proofProvider: import("@midnight-ntwrk/midnight-js-types").ProofProvider;
    walletProvider: {
        getCoinPublicKey: () => any;
        getEncryptionPublicKey: () => any;
        balanceTx(tx: any, ttl?: Date): Promise<any>;
        submitTx: (tx: any) => any;
    };
    midnightProvider: {
        getCoinPublicKey: () => any;
        getEncryptionPublicKey: () => any;
        balanceTx(tx: any, ttl?: Date): Promise<any>;
        submitTx: (tx: any) => any;
    };
}>;
export declare function generateSeedHex(): string;
//# sourceMappingURL=midnight-utils.d.ts.map