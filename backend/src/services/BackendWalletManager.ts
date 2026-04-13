import * as Rx from 'rxjs';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { createMidnightWallet, createProviders } from './midnight-utils.js';

class BackendWalletManagerImpl {
  private walletCtx: any = null;
  private providers: any = null;
  private seed: string = '';
  private stateSubscription: Rx.Subscription | null = null;
  private isReconnecting: boolean = false;
  public isReady: boolean = false;

  get WalletCtx() {
    if (!this.walletCtx) throw new Error('Backend wallet not initialized.');
    return this.walletCtx;
  }

  get Providers() {
    if (!this.providers) throw new Error('Backend providers not initialized.');
    return this.providers;
  }

  async initialize(seed: string) {
    this.seed = seed;
    console.log('Initializing backend wallet in background...');
    try {
      await this.connect();
      this.isReady = true;
      console.log('Backend wallet fully synced and ready.');
    } catch (error) {
      console.error('ERROR: Backend wallet initialization failed.');
      console.error(error);
    }
  }

  private async connect() {
    if (this.walletCtx) {
      console.log('Closing old wallet connection...');
      try {
        if (this.walletCtx.wallet.close) {
          await this.walletCtx.wallet.close();
        }
      } catch (e) {
        console.error('Error closing old wallet:', e);
      }
    }

    this.walletCtx = await createMidnightWallet(this.seed);

    // Log wallet address so the user can verify balances on the explorer
    const walletAddress = this.walletCtx.unshieldedKeystore.getBech32Address();
    console.log(`Backend wallet address: ${walletAddress}`);
    console.log('Syncing with Midnight Network...');

    const syncStart = Date.now();

    // Log progress every 10 seconds
    const progressSub = this.walletCtx.wallet.state().pipe(
      Rx.throttleTime(10000),
    ).subscribe((s: any) => {
      const uSync = s.unshielded?.progress?.isStrictlyComplete?.() === true;
      const dSync = s.dust?.progress?.isStrictlyComplete?.() === true;
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(0);
      console.log(`[Wallet Sync ${elapsed}s] Unshielded: ${uSync} | Dust: ${dSync}`);
    });

    try {
      // Phase 1: Wait for unshielded sync (critical — always works)
      await Promise.race([
        Rx.firstValueFrom(
          this.walletCtx.wallet.state().pipe(
            Rx.throttleTime(3000),
            Rx.filter((s: any) => s.unshielded?.progress?.isStrictlyComplete?.() === true),
          ),
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Unshielded sync timed out after 5 minutes')), 300000)
        ),
      ]);
      const uElapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
      console.log(`Unshielded wallet synced in ${uElapsed}s.`);

      // Get fresh state for balance check and dust registration
      const freshState: any = await Rx.firstValueFrom(this.walletCtx.wallet.state());

      // Log balances for diagnostics
      try {
        const nightBalance = freshState.unshielded?.balances?.[ledger.unshieldedToken().raw] ?? 0n;
        console.log(`NIGHT balance: ${nightBalance}`);
      } catch (e) {
        console.warn('Could not read NIGHT balance:', e);
      }
      try {
        const dustBal = freshState.dust?.walletBalance?.(new Date());
        console.log(`DUST balance: ${dustBal ?? 'undefined (dust not synced)'}`);
      } catch (e) {
        console.warn('Could not read DUST balance:', e);
      }

      // Phase 2: Register NIGHT UTXOs for dust generation if needed
      console.log('--- Dust Registration Check ---');
      await this.ensureDustRegistration(freshState);
      console.log('--- Dust Registration Check Complete ---');

      // Phase 3: Wait for dust to sync / generate
      const DUST_TIMEOUT_MS = 180000; // 3 minutes — give time after registration
      try {
        await Promise.race([
          Rx.firstValueFrom(
            this.walletCtx.wallet.state().pipe(
              Rx.throttleTime(5000),
              Rx.filter((s: any) => {
                const dSync = s.dust?.progress?.isStrictlyComplete?.() === true;
                if (dSync) return true;
                // Also check if we at least have a non-zero dust balance
                try {
                  const bal = s.dust?.walletBalance?.(new Date()) ?? 0n;
                  if (typeof bal === 'bigint' && bal > 0n) {
                    console.log(`Dust balance detected: ${bal} (sync not complete but balance available)`);
                    return true;
                  }
                } catch { /* ignore */ }
                return false;
              }),
            ),
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Dust sync window expired')), DUST_TIMEOUT_MS)
          ),
        ]);
        const dElapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
        console.log(`Dust wallet ready in ${dElapsed}s.`);
      } catch (_dustErr) {
        const dElapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
        console.warn(`Dust not ready after ${dElapsed}s.`);
        console.warn('⚠ Proof generation WILL FAIL with "Insufficient Funds: could not balance dust"');
        console.warn('→ Verify this wallet has DUST on the explorer: ' + walletAddress);
        console.warn('→ If no DUST, fund the wallet with NIGHT from the faucet and wait for dust generation.');
      }
    } catch (e) {
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
      console.error(`Critical: Unshielded sync failed after ${elapsed}s: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      progressSub.unsubscribe();
    }

    this.providers = await createProviders(this.walletCtx);
    console.log('Providers created successfully.');

    // Watch for disconnection
    if (this.stateSubscription) this.stateSubscription.unsubscribe();

    this.stateSubscription = this.walletCtx.wallet.state().subscribe({
      next: (_state: any) => {},
      error: async (err: any) => {
        if (this.isReconnecting) return;
        this.isReconnecting = true;
        console.error('Wallet disconnected, reconnecting...');
        setTimeout(async () => {
          try {
            await this.connect();
            this.isReady = true;
            console.log('Wallet reconnected.');
            this.isReconnecting = false;
          } catch (e) {
            console.error('Wallet reconnect failed:', e);
            this.isReconnecting = false;
          }
        }, 5000);
      },
      complete: async () => {
        if (this.isReconnecting) return;
        this.isReconnecting = true;
        console.warn('Wallet stream completed, reconnecting...');
        setTimeout(async () => {
          try {
            await this.connect();
            this.isReady = true;
            console.log('Wallet reconnected.');
            this.isReconnecting = false;
          } catch (e) {
            console.error('Wallet reconnect failed:', e);
            this.isReconnecting = false;
          }
        }, 5000);
      }
    });
  }

  /**
   * Register NIGHT UTXOs for dust generation if needed.
   * Mirrors deploy.ts logic. This is critical after contract deployment
   * because the original registered UTXOs get consumed.
   */
  private async ensureDustRegistration(state: any): Promise<void> {
    // Check existing dust balance
    let dustBalance: bigint = 0n;
    try {
      const bal = state.dust?.walletBalance?.(new Date());
      dustBalance = typeof bal === 'bigint' ? bal : 0n;
    } catch { /* dust wallet might not be synced */ }

    if (dustBalance > 0n) {
      console.log(`Dust already available (balance: ${dustBalance}), skipping registration.`);
      return;
    }

    // Check for unregistered NIGHT UTXOs
    const allCoins = state.unshielded?.availableCoins ?? [];
    console.log(`Total unshielded coins/UTXOs found: ${allCoins.length}`);

    const nightUtxos = allCoins.filter(
      (c: any) => !c.meta?.registeredForDustGeneration,
    );
    console.log(`Unregistered for dust: ${nightUtxos.length}`);

    if (nightUtxos.length === 0) {
      console.log('All NIGHT UTXOs already registered (or none exist). Cannot register for dust.');
      console.log('If dust balance is 0, the wallet may need more NIGHT from the faucet.');
      return;
    }

    console.log(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation...`);
    try {
      const recipe = await this.walletCtx.wallet.registerNightUtxosForDustGeneration(
        nightUtxos,
        this.walletCtx.unshieldedKeystore.getPublicKey(),
        (payload: Uint8Array) => this.walletCtx.unshieldedKeystore.signData(payload),
      );
      console.log('Dust registration recipe created. Finalizing and submitting...');
      const finalized = await this.walletCtx.wallet.finalizeRecipe(recipe);
      await this.walletCtx.wallet.submitTransaction(finalized);
      console.log('✓ NIGHT UTXOs registered for dust generation. Waiting for dust to accumulate...');
    } catch (regErr) {
      console.error('✗ Failed to register NIGHT UTXOs for dust:', regErr);
    }
  }

  async shutdown() {
    console.log('Shutting down wallet connection...');
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }
}

export const BackendWalletManager = new BackendWalletManagerImpl();
