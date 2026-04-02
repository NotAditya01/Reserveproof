/**
 * Deploy ep-contract to the Midnight Preprod network.
 *
 * Usage: cd backend && npm run deploy
 *
 * This script will:
 * 1. Generate (or reuse) BACKEND_WALLET_SEED in ../.env
 * 2. Create a wallet and fund it via the Midnight faucet
 * 3. Wait for DUST generation
 * 4. Deploy ep-contract to the Midnight network
 * 5. Save CONTRACT_ADDRESS to ../.env
 */

import { config } from 'dotenv';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env BEFORE any Midnight SDK imports (they read env vars at module load time)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '..', '.env');
config({ path: envPath });

// ─── Helper: update or append a key=value in .env ──────────────────────────────

function setEnvValue(key: string, value: string): void {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf-8');
}

function getOrCreatePrivateStatePassword(): string {
  let password = process.env.PRIVATE_STATE_PASSWORD ?? '';
  if (password.length < 16) {
    password = crypto.randomBytes(16).toString('hex');
    setEnvValue('PRIVATE_STATE_PASSWORD', password);
    process.env.PRIVATE_STATE_PASSWORD = password;
  }
  return password;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Ensure PRIVATE_STATE_PASSWORD exists before loading Midnight SDK modules
  getOrCreatePrivateStatePassword();

  // Dynamic imports — these must happen AFTER dotenv has loaded
  const Rx = await import('rxjs');
  const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');
  const { CompiledContract } = await import('@midnight-ntwrk/compact-js');
  const {
    createMidnightWallet,
    createProviders,
    loadContractModule,
    zkConfigPath,
  } = await import('./services/midnight-utils.js');

  const networkLabel = (process.env.NETWORK_ID || 'preprod').toUpperCase();
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║       Deploy ep-contract to Midnight ${networkLabel.padEnd(22)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Contract compilation check
  const contractIndexPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractIndexPath)) {
    console.error('❌ Contract not compiled! Run: npm run compile');
    process.exit(1);
  }
  console.log('✅ Compiled contract found\n');

  // 2. Backend wallet seed (24-word mnemonic)
  const seed = (process.env.BACKEND_WALLET_SEED ?? '').trim();
  if (!seed) {
    throw new Error(
      'BACKEND_WALLET_SEED is required and must be a 24-word mnemonic phrase from Lace',
    );
  }
  console.log(`  Using existing BACKEND_WALLET_SEED from .env\n`);

  // 3. Create wallet
  console.log('─── Creating Wallet ────────────────────────────────────────────\n');
  const walletCtx = await createMidnightWallet(seed);

  console.log('  Syncing wallet with Midnight network...');

  // Wait for unshielded wallet to sync (shielded takes very long on first run)
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.throttleTime(3000),
      Rx.tap(() => process.stdout.write('.')),
      Rx.filter((s: any) => s.unshielded?.progress?.isStrictlyComplete?.() === true),
    ),
  );

  console.log('\n  ✅ Wallet synced!\n');

  const address = walletCtx.unshieldedKeystore.getBech32Address();
  const { unshieldedToken } = await import('@midnight-ntwrk/ledger-v8');
  const balance = (state as any).unshielded?.balances?.[unshieldedToken().raw] ?? 0n;
  console.log(`  Wallet Address: ${address}`);
  console.log(`  Balance: ${balance.toLocaleString()} tNIGHT\n`);

  // 4. Fund wallet — preprod requires manual faucet funding
  if (balance === 0n) {
    console.log('  ⚠️  Balance is 0 — fund this wallet from the Midnight faucet:\n');
    console.log('      https://faucet.preprod.midnight.network/\n');
    console.log(`      Wallet Address: ${address}\n`);
    console.log('  Waiting for funds (poll every 15s)...');
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(15000),
        Rx.tap(() => process.stdout.write('.')),
        Rx.filter((s: any) => {
          const bal = s.unshielded?.balances?.[unshieldedToken().raw] ?? 0n;
          return bal > 0n;
        }),
      ),
    );
    console.log('\n  ✅ Funds received!\n');
  }

  // 5. DUST setup
  console.log('─── DUST Token Setup ───────────────────────────────────────────\n');
  const dustState = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.throttleTime(3000),
      Rx.filter((s: any) => s.isSynced === true),
    ),
  );

  if ((dustState as any).dust?.walletBalance?.(new Date()) === 0n) {
    const nightUtxos = ((dustState as any).unshielded?.availableCoins ?? []).filter(
      (c: any) => !c.meta?.registeredForDustGeneration,
    );

    if (nightUtxos.length > 0) {
      console.log('  Registering for DUST generation...');
      const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
        nightUtxos,
        walletCtx.unshieldedKeystore.getPublicKey(),
        (payload: Uint8Array) => walletCtx.unshieldedKeystore.signData(payload),
      );
      await walletCtx.wallet.submitTransaction(
        await walletCtx.wallet.finalizeRecipe(recipe),
      );
    }

    console.log('  Waiting for DUST tokens...');
    const timeoutMs = Number(process.env.DUST_WAIT_TIMEOUT_MS ?? '120000');
    const waitForDust = Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s: any) => s.unshielded?.progress?.isStrictlyComplete?.() === true),
        Rx.filter((s: any) => (s.dust?.walletBalance?.(new Date()) ?? 0n) > 0n),
      ),
    );
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for DUST after ${timeoutMs}ms. ` +
              'Generate spendable DUST in Lace and retry.',
          ),
        );
      }, timeoutMs);
    });
    await Promise.race([waitForDust, timeout]);
  }
  console.log('  ✅ DUST tokens ready!\n');

  // 6. Deploy contract
  console.log('─── Deploying Contract ─────────────────────────────────────────\n');
  console.log('  Setting up providers...');
  const providers = await createProviders(walletCtx);

  const ContractModule = await loadContractModule();

  // Build CompiledContract — must provide getReserveWitness even for deploy
  const deployWitnesses = {
    getReserveWitness(context: any) {
      const ps = context.privateState;
      return [ps, { score: ps.score ?? 300n, salt: ps.salt ?? new Uint8Array(32) }];
    },
  };

  const compiledContract = CompiledContract.make('ep-contract', ContractModule.Contract).pipe(
    (CompiledContract.withWitnesses as any)(deployWitnesses),
    (CompiledContract.withCompiledFileAssets as any)(zkConfigPath),
  );

  console.log('  Deploying contract (this may take 30-60 seconds)...\n');
  const deployed = await (deployContract as any)(providers, {
    compiledContract,
    privateStateId: 'epContractState',
    initialPrivateState: {},
  });

  const contractAddress = (deployed as any).deployTxData.public.contractAddress;
  console.log(`  ✅ Contract deployed successfully!\n`);
  console.log(`  Contract Address: ${contractAddress}\n`);

  // 7. Save to .env
  setEnvValue('CONTRACT_ADDRESS', contractAddress);
  console.log('  ✅ CONTRACT_ADDRESS saved to .env\n');

  // 8. Save deployment.json
  const deploymentInfo = {
    contractAddress,
    network: process.env.NETWORK_ID || 'undeployed',
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.resolve(__dirname, '..', '..', 'deployment.json'),
    JSON.stringify(deploymentInfo, null, 2),
  );
  console.log('  ✅ Saved to deployment.json\n');

  await walletCtx.wallet.stop();
  console.log('─── Deployment Complete! ────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('❌ Deploy failed:', err);
  process.exit(1);
});
