import * as crypto from 'crypto';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { loadContractModule, zkConfigPath, } from './midnight-utils.js';
import { BackendWalletManager } from './BackendWalletManager.js';
export class VerificationProof {
    async generateVerificationProof(params) {
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
                getReserveWitness(context) {
                    const privateState = context.privateState;
                    let score = privateState.score;
                    if (typeof score !== 'bigint') {
                        score = BigInt(score);
                    }
                    let salt = privateState.salt;
                    if (!(salt instanceof Uint8Array)) {
                        if (salt.type === 'Buffer' && Array.isArray(salt.data)) {
                            salt = new Uint8Array(salt.data);
                        }
                        else {
                            salt = new Uint8Array(Object.values(salt));
                        }
                    }
                    return [
                        privateState,
                        { score, salt },
                    ];
                },
            };
            const compiledContract = CompiledContract.make('ep-contract', ContractModule.Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(zkConfigPath));
            // 4. Generate request ID and salt
            const requestIdBytes = crypto.randomBytes(32);
            const requestId = new Uint8Array(requestIdBytes);
            const salt = new Uint8Array(crypto.randomBytes(32));
            const reserveScore = BigInt(Math.round(reserveRatio));
            // 5. Connect to the deployed contract
            console.log('📡 Connecting to deployed contract...');
            const privateStateId = `epContractState_${requestIdBytes.toString('hex')}`;
            const deployedContract = await findDeployedContract(providers, {
                compiledContract,
                contractAddress,
                privateStateId,
                initialPrivateState: {
                    score: reserveScore,
                    salt,
                },
            });
            // 6. Call the proveReserveStatus circuit — this creates and submits a TX
            console.log(`🔐 Generating ZK proof with thresholdBigInt: ${thresholdBigInt}, reserveScore: ${reserveScore}`);
            const result = await deployedContract.callTx.proveReserveStatus(thresholdBigInt, requestId);
            // 7. Extract TX hash from the result
            const txHash = result?.txHash
                ?? result?.public?.txHash
                ?? result?.deployTxData?.public?.txHash
                ?? Buffer.from(requestId).toString('hex').slice(0, 64);
            console.log(`✅ Proof submitted on-chain! TX: ${txHash}`);
            await walletCtx.wallet.stop();
            return {
                success: true,
                requestId: Buffer.from(requestId).toString('hex'),
                salt: Buffer.from(salt).toString('hex'),
                txHash: typeof txHash === 'string' ? txHash : String(txHash),
            };
        }
        catch (error) {
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
//# sourceMappingURL=VerificationProof.js.map