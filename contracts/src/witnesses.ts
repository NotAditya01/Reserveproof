import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../managed/ep-contract/contract/index.d.cts';

export type PrivateState = {
  score: bigint;
  salt: Uint8Array;
};

export function createPrivateState(
  score: bigint,
  salt: Uint8Array
): PrivateState {
  return { score, salt };
}

export type ReserveWitness = {
  score: bigint;
  salt: Uint8Array;
};

export const witnesses: Witnesses<PrivateState> = {
  getReserveWitness(
    context: WitnessContext<Ledger, PrivateState>
  ): [PrivateState, ReserveWitness] {
    const { privateState } = context;

    const reserveWitness: ReserveWitness = {
      score: privateState.score,
      salt: privateState.salt,
    };

    return [privateState, reserveWitness];
  },
};
