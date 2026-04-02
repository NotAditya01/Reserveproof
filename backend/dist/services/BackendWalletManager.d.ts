declare class BackendWalletManagerImpl {
    private walletCtx;
    private providers;
    private seed;
    private stateSubscription;
    private isReconnecting;
    get WalletCtx(): any;
    get Providers(): any;
    initialize(seed: string): Promise<void>;
    private connect;
    shutdown(): Promise<void>;
}
export declare const BackendWalletManager: BackendWalletManagerImpl;
export {};
//# sourceMappingURL=BackendWalletManager.d.ts.map