
import * as crypto from 'crypto';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import {
  loadContractModule,
  zkConfigPath,
} from './midnight-utils.js';
import { BackendWalletManager } from './BackendWalletManager.js';

export interface ProofGenerationParams {
  reserveRatio?: number;
  tierThreshold?: number;
  // Legacy compatibility
  netPay?: number;
  amountToProve?: number;
}

export interface ProofGenerationResult {
  success: boolean;
  requestId: string;
  salt: string;
  txHash: string;
  error?: string;
}

export class VerificationProof {
  async generateVerificationProof(params: ProofGenerationParams): Promise<ProofGenerationResult> {
    const backendSeed = process.env.BACKEND_WALLET_SEED;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!backendSeed) {
      return {
        success: false,
        requestId: '',
        salt: '',
        txHash: '',
        error: 'BACKEND_WALLET_SEED not set. Run: cd backend && npm run deploy',
      };
    }

    if (!contractAddress) {
      return {
        success: false,
        requestId: '',
        salt: '',
        txHash: '',
        error: 'CONTRACT_ADDRESS not set. Run: cd backend && npm run deploy',
      };
    }

    try {
      const reserveRatio = params.reserveRatio ?? params.netPay ?? 300;
      const tierThreshold = params.tierThreshold ?? params.amountToProve ?? 300;
      const thresholdBigInt = BigInt(Math.round(tierThreshold));

      // 1-2. Fetch persisted backend wallet connection
      const walletCtx = BackendWalletManager.WalletCtx;
      const providers = BackendWalletManager.Providers;

      // 3. Load contract module and build compiled contract
      const ContractModule = await loadContractModule();

      const witnesses = {
        getReserveWitness(context: any) {
          const privateState = context.privateState;
          
          let score = privateState.score;
          if (typeof score !== 'bigint') {
            score = BigInt(score);
          }

          let salt = privateState.salt;
          if (!(salt instanceof Uint8Array)) {
             if (salt.type === 'Buffer' && Array.isArray(salt.data)) {
                 salt = new Uint8Array(salt.data);
             } else {
                 salt = new Uint8Array(Object.values(salt));
             }
          }

          return [
            privateState,
            { score, salt },
          ] as [any, { score: bigint; salt: Uint8Array }];
        },
      };

      const compiledContract = (CompiledContract.make as any)('ep-contract', ContractModule.Contract).pipe(
        (CompiledContract.withWitnesses as any)(witnesses),
        (CompiledContract.withCompiledFileAssets as any)(zkConfigPath),
      );

      // 4. Generate request ID and salt
      const requestIdBytes = crypto.randomBytes(32);
      const requestId = new Uint8Array(requestIdBytes);
      const salt = new Uint8Array(crypto.randomBytes(32));
      const reserveScore = BigInt(Math.round(reserveRatio));

      // 5. Sync wallet state before proof (CRITICAL — original working logic)
      console.log('Synchronizing Midnight network nonces...');
      await walletCtx.wallet.waitForSyncedState();
      console.log('Wallet synchronization complete.');

      if (global.gc) {
        console.log('Forcing V8 Garbage Collection to free RAM for WASM Prover...');
        global.gc();
      }

      // 6. Connect to the deployed contract
      console.log('Connecting to deployed contract...');
      const privateStateId = `epContractState_${requestIdBytes.toString('hex')}`;
      const deployedContract = await (findDeployedContract as any)(providers, {
        compiledContract,
        contractAddress,
        privateStateId,
        initialPrivateState: {
          score: reserveScore,
          salt,
        },
      });

      // 7. Call the proveReserveStatus circuit — NO TIMEOUT, let it finish naturally
      console.log(`Generating ZK proof with thresholdBigInt: ${thresholdBigInt}, reserveScore: ${reserveScore}`);
      const result = await deployedContract.callTx.proveReserveStatus(
        thresholdBigInt,
        requestId,
      );

      // 8. Extract TX hash from the result
      const txHash = (result as any)?.txHash
        ?? (result as any)?.public?.txHash
        ?? (result as any)?.deployTxData?.public?.txHash
        ?? Buffer.from(requestId).toString('hex').slice(0, 64);

      console.log(`Proof submitted on-chain. TX: ${txHash}`);

      return {
        success: true,
        requestId: Buffer.from(requestId).toString('hex'),
        salt: Buffer.from(salt).toString('hex'),
        txHash: typeof txHash === 'string' ? txHash : String(txHash),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('ZK proof generation/submission error:', errMsg);
      return {
        success: false,
        requestId: '',
        salt: '',
        txHash: '',
        error: errMsg,
      };
    }
  }
}
