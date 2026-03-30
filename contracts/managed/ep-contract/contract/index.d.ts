import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  getReserveWitness(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { score: bigint,
                                                                                  salt: Uint8Array
                                                                                }];
}

export type ImpureCircuits<PS> = {
  proveReserveStatus(context: __compactRuntime.CircuitContext<PS>,
                     minTierThreshold_0: bigint,
                     requestId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  getVerifiedResult(context: __compactRuntime.CircuitContext<PS>,
                    requestId_0: Uint8Array): __compactRuntime.CircuitResults<PS, { scoreCommitment: Uint8Array,
                                                                                    tier: Uint8Array,
                                                                                    verified: boolean
                                                                                  }>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  proveReserveStatus(context: __compactRuntime.CircuitContext<PS>,
                     minTierThreshold_0: bigint,
                     requestId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  getVerifiedResult(context: __compactRuntime.CircuitContext<PS>,
                    requestId_0: Uint8Array): __compactRuntime.CircuitResults<PS, { scoreCommitment: Uint8Array,
                                                                                    tier: Uint8Array,
                                                                                    verified: boolean
                                                                                  }>;
}

export type Ledger = {
  verifications: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { scoreCommitment: Uint8Array,
                                 tier: Uint8Array,
                                 verified: boolean
                               };
    [Symbol.iterator](): Iterator<[Uint8Array, { scoreCommitment: Uint8Array, tier: Uint8Array, verified: boolean }]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
