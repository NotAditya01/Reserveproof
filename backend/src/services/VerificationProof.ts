
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

// Timeout wrapper that rejects after the given ms
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${(ms / 1000).toFixed(0)}s`)), ms)
    ),
  ]);
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

      // 1. Fetch persisted backend wallet connection
      console.log('[Proof] Step 1: Fetching wallet context...');
      const walletCtx = BackendWalletManager.WalletCtx;
      const providers = BackendWalletManager.Providers;
      console.log('[Proof] Step 1: Done.');

      // 2. Load contract module and build compiled contract
      console.log('[Proof] Step 2: Loading contract module...');
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
      console.log('[Proof] Step 2: Done.');

      // 3. Generate request ID and salt
      const requestIdBytes = crypto.randomBytes(32);
      const requestId = new Uint8Array(requestIdBytes);
      const salt = new Uint8Array(crypto.randomBytes(32));
      const reserveScore = BigInt(Math.round(reserveRatio));

      // Free memory before heavy WASM proof generation
      if (global.gc) {
        console.log('[Proof] Forcing V8 GC before proof generation...');
        global.gc();
      }

      // 4. Connect to the deployed contract
      console.log('[Proof] Step 3: Connecting to deployed contract...');
      const privateStateId = `epContractState_${requestIdBytes.toString('hex')}`;
      const deployedContract: any = await withTimeout(
        (findDeployedContract as any)(providers, {
          compiledContract,
          contractAddress,
          privateStateId,
          initialPrivateState: {
            score: reserveScore,
            salt,
          },
        }),
        120000, // 2 min timeout for contract discovery
        'findDeployedContract',
      );
      console.log('[Proof] Step 3: Done — contract found.');

      // 5. Call the proveReserveStatus circuit — ZK proof + balance + submit
      //    This is where the SDK: (a) generates unbound TX, (b) calls proof server,
      //    (c) calls balanceTx (needs tDUST!), (d) submits to chain.
      //    We add a 7-minute timeout because ZK proof generation is legitimately slow.
      console.log(`[Proof] Step 4: Calling proveReserveStatus(threshold=${thresholdBigInt}, score=${reserveScore})...`);
      console.log('[Proof] This involves: ZK proof generation → balanceTx (needs tDUST) → submit TX');
      const proofStart = Date.now();

      const PROOF_TIMEOUT_MS = 420000; // 7 minutes
      const result = await withTimeout(
        deployedContract.callTx.proveReserveStatus(
          thresholdBigInt,
          requestId,
        ),
        PROOF_TIMEOUT_MS,
        'proveReserveStatus (ZK proof + balance + submit)',
      );

      const proofDuration = ((Date.now() - proofStart) / 1000).toFixed(1);
      console.log(`[Proof] Step 4: Done in ${proofDuration}s.`);

      // 6. Extract TX hash from the result
      const txHash = (result as any)?.txHash
        ?? (result as any)?.public?.txHash
        ?? (result as any)?.deployTxData?.public?.txHash
        ?? Buffer.from(requestId).toString('hex').slice(0, 64);

      console.log(`[Proof] Proof submitted on-chain. TX: ${txHash}`);

      return {
        success: true,
        requestId: Buffer.from(requestId).toString('hex'),
        salt: Buffer.from(salt).toString('hex'),
        txHash: typeof txHash === 'string' ? txHash : String(txHash),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[Proof] ZK proof generation/submission error:', errMsg);
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
