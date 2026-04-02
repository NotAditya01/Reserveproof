/**
 * User interface — wallet is typed as `any` because the backing implementation
 * switches between WalletFacade (wallet-sdk v3) and legacy Wallet types.
 */
export interface User {
    userID: number;
    email: string;
    wallet: any | null;
    idDOB?: Uint8Array;
    idName?: string;
}
//# sourceMappingURL=User.d.ts.map