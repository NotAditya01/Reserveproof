/**
 * WalletManager — Uses the new Midnight wallet-sdk packages (WalletFacade).
 * Used for user account management (sign-up registration wallet creation).
 */
export declare class WalletManager {
    createWalletAndReturnSeed(): Promise<{
        wallet: import("@midnight-ntwrk/wallet-sdk-facade").WalletFacade;
        seed: string;
        walletCtx: {
            wallet: import("@midnight-ntwrk/wallet-sdk-facade").WalletFacade;
            shieldedSecretKeys: import("@midnight-ntwrk/ledger-v8").ZswapSecretKeys;
            dustSecretKey: import("@midnight-ntwrk/ledger-v8").DustSecretKey;
            unshieldedKeystore: import("@midnight-ntwrk/wallet-sdk-unshielded-wallet").UnshieldedKeystore;
        };
    }>;
    restoreWallet(seed: string, _state: string): Promise<import("@midnight-ntwrk/wallet-sdk-facade").WalletFacade>;
}
//# sourceMappingURL=WalletManager.d.ts.map