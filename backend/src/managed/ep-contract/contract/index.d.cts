import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<T> = {
  getReserveWitness(context: __compactRuntime.WitnessContext<Ledger, T>): [T, { score: bigint,
                                                                                salt: Uint8Array
                                                                              }];
}

export type ImpureCircuits<T> = {
  proveReserveStatus(context: __compactRuntime.CircuitContext<T>,
                     minTierThreshold_0: bigint,
                     requestId_0: Uint8Array): __compactRuntime.CircuitResults<T, []>;
  getVerifiedResult(context: __compactRuntime.CircuitContext<T>,
                    requestId_0: Uint8Array): __compactRuntime.CircuitResults<T, { scoreCommitment: Uint8Array,
                                                                                   tier: Uint8Array,
                                                                                   verified: boolean
                                                                                 }>;
}

export type PureCircuits = {
}

export type Circuits<T> = {
  proveReserveStatus(context: __compactRuntime.CircuitContext<T>,
                     minTierThreshold_0: bigint,
                     requestId_0: Uint8Array): __compactRuntime.CircuitResults<T, []>;
  getVerifiedResult(context: __compactRuntime.CircuitContext<T>,
                    requestId_0: Uint8Array): __compactRuntime.CircuitResults<T, { scoreCommitment: Uint8Array,
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

export declare class Contract<T, W extends Witnesses<T> = Witnesses<T>> {
  witnesses: W;
  circuits: Circuits<T>;
  impureCircuits: ImpureCircuits<T>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<T>): __compactRuntime.ConstructorResult<T>;
}

export declare function ledger(state: __compactRuntime.StateValue): Ledger;
export declare const pureCircuits: PureCircuits;
