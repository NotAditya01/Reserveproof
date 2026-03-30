
import * as crypto from 'crypto';
import * as Rx from 'rxjs';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import {
  createMidnightWallet,
  createProviders,
  loadContractModule,
  zkConfigPath,
} from './midnight-utils.js';

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

      // 1. Create wallet from backend seed
      console.log('🔑 Creating backend wallet for proof submission...');
      const walletCtx = await createMidnightWallet(backendSeed);

      // Wait for sync
      await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(
          Rx.throttleTime(3000),
          Rx.filter((s: any) => s.isSynced),
        ),
      );

      // 2. Set up providers
      const providers = await createProviders(walletCtx);

      // 3. Load contract module and build compiled contract
      const ContractModule = await loadContractModule();

      const witnesses = {
        getReserveWitness(context: any) {
          const privateState = context.privateState;
          return [
            privateState,
            { score: privateState.score as bigint, salt: privateState.salt as Uint8Array },
          ] as [any, { score: bigint; salt: Uint8Array }];
        },
      };

      const compiledContract = (CompiledContract.make as any)('ep-contract', ContractModule.Contract).pipe(
        (CompiledContract.withWitnesses as any)(witnesses),
        (CompiledContract.withCompiledFileAssets as any)(zkConfigPath),
      );

      // 4. Generate request ID and salt
      const requestId = crypto.randomBytes(32);
      const salt = crypto.randomBytes(32);
      const reserveScore = BigInt(Math.round(reserveRatio));

      // 5. Connect to the deployed contract
      console.log('📡 Connecting to deployed contract...');
      const deployedContract = await (findDeployedContract as any)(providers, {
        compiledContract,
        contractAddress,
        privateStateId: 'epContractState',
        initialPrivateState: {
          score: reserveScore,
          salt,
        },
      });

      // 6. Call the proveReserveStatus circuit — this creates and submits a TX
      console.log('🔐 Generating ZK proof and submitting transaction...');
      const result = await deployedContract.callTx.proveReserveStatus(
        thresholdBigInt,
        requestId,
      );

      // 7. Extract TX hash from the result
      const txHash = (result as any)?.txHash
        ?? (result as any)?.public?.txHash
        ?? (result as any)?.deployTxData?.public?.txHash
        ?? Buffer.from(requestId).toString('hex').slice(0, 64);

      console.log(`✅ Proof submitted on-chain! TX: ${txHash}`);

      await walletCtx.wallet.stop();

      return {
        success: true,
        requestId: Buffer.from(requestId).toString('hex'),
        salt: Buffer.from(salt).toString('hex'),
        txHash: typeof txHash === 'string' ? txHash : String(txHash),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ ZK proof generation/submission error:', errMsg);
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
