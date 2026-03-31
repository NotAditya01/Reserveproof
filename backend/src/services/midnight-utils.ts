

import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

// Midnight SDK imports
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

// Enable WebSocket for GraphQL subscriptions
// @ts-expect-error Required for wallet sync in Node.js
globalThis.WebSocket = WebSocket;

// Set network from environment (default: preprod)
setNetworkId(process.env.NETWORK_ID || 'preprod');

// ─── Network Configuration ────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const CONFIG = {
  indexer: requireEnv('INDEXER_URL'),
  indexerWS: requireEnv('INDEXER_WS_URL'),
  node: requireEnv('NODE_URL'),
  proofServer: requireEnv('PROVE_SERVER_URL'),
};

const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD;
if (!privateStatePassword || privateStatePassword.length < 16) {
  throw new Error('Missing required environment variable: PRIVATE_STATE_PASSWORD');
}

const buildShieldedConfig = (cfg: typeof CONFIG) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: cfg.indexer,
    indexerWsUrl: cfg.indexerWS,
  },
  provingServerUrl: new URL(cfg.proofServer),
  relayURL: new URL(cfg.node.replace(/^http/, 'ws')),
});

const buildUnshieldedConfig = (cfg: typeof CONFIG) => ({
  networkId: getNetworkId(),
  indexerClientConnection: {
    indexerHttpUrl: cfg.indexer,
    indexerWsUrl: cfg.indexerWS,
  },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(),
});

const buildDustConfig = (cfg: typeof CONFIG) => ({
  networkId: getNetworkId(),
  costParameters: {
    additionalFeeOverhead: 300_000_000_000_000n,
    feeBlocksMargin: 5,
  },
  indexerClientConnection: {
    indexerHttpUrl: cfg.indexer,
    indexerWsUrl: cfg.indexerWS,
  },
  provingServerUrl: new URL(cfg.proofServer),
  relayURL: new URL(cfg.node.replace(/^http/, 'ws')),
});


const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(__dirname, '..', '..', '..', 'contracts', 'managed', 'ep-contract');

// ─── Contract Loading 

export async function loadContractModule() {
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  return await import(pathToFileURL(contractPath).href);
}

// ─── Wallet Functions 

export function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');

  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

export async function createMidnightWallet(seed: string) {
  const keys = deriveKeys(seed);

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], getNetworkId());

  const walletConfig = {
    ...buildShieldedConfig(CONFIG),
    ...buildUnshieldedConfig(CONFIG),
    ...buildDustConfig(CONFIG),
  };

  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (cfg) =>
      DustWallet(cfg).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}



export function signTransactionIntents(
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >('signature', proofMarker, 'pre-binding', intent.serialize());

    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: any, i: number) =>
          cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer =
        cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: any, i: number) =>
          cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer =
        cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
}



export async function createProviders(
  walletCtx: Awaited<ReturnType<typeof createMidnightWallet>>,
) {
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.throttleTime(3000),
      Rx.filter((s: any) => s.unshielded?.progress?.isStrictlyComplete?.() === true),
    ),
  );

  const walletProvider = {
    getCoinPublicKey: () => (state as any).shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => (state as any).shielded.encryptionPublicKey.toHexString(),

    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        {
          shieldedSecretKeys: walletCtx.shieldedSecretKeys,
          dustSecretKey: walletCtx.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      const signFn = (payload: Uint8Array) =>
        walletCtx.unshieldedKeystore.signData(payload);

      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }

      return walletCtx.wallet.finalizeRecipe(recipe) as any;
    },

    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'ep-contract-state',
      privateStoragePasswordProvider: () => privateStatePassword,
      accountId: String(walletCtx.unshieldedKeystore.getBech32Address()),
      walletProvider,
    }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}



export function generateSeedHex(): string {
  return toHex(Buffer.from(generateRandomSeed()));
}
