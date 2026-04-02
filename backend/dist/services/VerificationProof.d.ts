export interface ProofGenerationParams {
    reserveRatio?: number;
    tierThreshold?: number;
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
export declare class VerificationProof {
    generateVerificationProof(params: ProofGenerationParams): Promise<ProofGenerationResult>;
}
//# sourceMappingURL=VerificationProof.d.ts.map