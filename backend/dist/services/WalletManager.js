/**
 * WalletManager — Uses the new Midnight wallet-sdk packages (WalletFacade).
 * Used for user account management (sign-up registration wallet creation).
 */
import { Buffer } from 'buffer';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { createMidnightWallet } from './midnight-utils.js';
export class WalletManager {
    async createWalletAndReturnSeed() {
        try {
            const seed = toHex(Buffer.from(generateRandomSeed()));
            const walletCtx = await createMidnightWallet(seed);
            return { wallet: walletCtx.wallet, seed, walletCtx };
        }
        catch (error) {
            throw new Error(`Failed to create wallet: ${error}`);
        }
    }
    async restoreWallet(seed, _state) {
        try {
            const walletCtx = await createMidnightWallet(seed);
            return walletCtx.wallet;
        }
        catch (error) {
            throw new Error(`Failed to restore wallet: ${error}`);
        }
    }
}
//# sourceMappingURL=WalletManager.js.map