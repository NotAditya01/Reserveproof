import * as Rx from 'rxjs';
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
      // Don't exit — keep server alive for Azure health checks
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
      // Phase 1: Wait for unshielded sync (critical — always works, usually <30s)
      const syncedState: any = await Promise.race([
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

      // Log balances for diagnostics
      try {
        const { unshieldedToken } = await import('@midnight-ntwrk/ledger-v8');
        const nightBalance = syncedState.unshielded?.balances?.[unshieldedToken().raw] ?? 0n;
        console.log(`NIGHT balance: ${nightBalance}`);
        const dustBalance = syncedState.dust?.walletBalance?.(new Date()) ?? 'unknown';
        console.log(`DUST balance: ${dustBalance}`);
      } catch (balErr) {
        console.warn('Could not read balances:', balErr);
      }

      // Phase 2: Ensure NIGHT UTXOs are registered for dust generation
      // This mirrors deploy.ts behavior — needed on every cold start when
      // new UTXOs exist that haven't been registered yet.
      try {
        await this.ensureDustRegistration(syncedState);
      } catch (regErr) {
        console.warn('Dust registration check failed (non-fatal):', regErr);
      }

      // Phase 3: Give dust wallet a window to sync after registration
      const DUST_TIMEOUT_MS = 120000; // 2 minutes
      try {
        await Promise.race([
          Rx.firstValueFrom(
            this.walletCtx.wallet.state().pipe(
              Rx.throttleTime(5000),
              Rx.filter((s: any) => s.dust?.progress?.isStrictlyComplete?.() === true),
            ),
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Dust sync window expired')), DUST_TIMEOUT_MS)
          ),
        ]);
        const dElapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
        console.log(`Dust wallet synced in ${dElapsed}s.`);
      } catch (_dustErr) {
        const dElapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
        console.warn(`Dust sync did not complete within ${DUST_TIMEOUT_MS / 1000}s (total ${dElapsed}s).`);
        console.warn('Proof generation may hang if tDUST UTXOs are not discoverable.');
      }
    } catch (e) {
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
      console.error(`Critical: Unshielded sync failed after ${elapsed}s: ${e instanceof Error ? e.message : String(e)}`);
      console.warn('Proceeding anyway — proof generation may fail.');
    } finally {
      progressSub.unsubscribe();
    }

    this.providers = await createProviders(this.walletCtx);
    console.log('Providers created successfully.');

    // Watch for disconnection
    if (this.stateSubscription) this.stateSubscription.unsubscribe();

    this.stateSubscription = this.walletCtx.wallet.state().subscribe({
      next: (_state: any) => {
        // Silent — no continuous logging churn
      },
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
   * Check if NIGHT UTXOs are registered for dust generation.
   * If not, register them — same logic as deploy.ts.
   */
  private async ensureDustRegistration(state: any): Promise<void> {
    const dustBalance = state.dust?.walletBalance?.(new Date()) ?? 0n;
    if (typeof dustBalance === 'bigint' && dustBalance > 0n) {
      console.log(`Dust already available (balance: ${dustBalance}), skipping registration.`);
      return;
    }

    console.log('No dust balance detected — checking for unregistered NIGHT UTXOs...');
    const nightUtxos = (state.unshielded?.availableCoins ?? []).filter(
      (c: any) => !c.meta?.registeredForDustGeneration,
    );

    if (nightUtxos.length === 0) {
      console.log('All NIGHT UTXOs already registered for dust generation (or none available).');
      return;
    }

    console.log(`Found ${nightUtxos.length} unregistered NIGHT UTXO(s). Registering for dust generation...`);
    try {
      const recipe = await this.walletCtx.wallet.registerNightUtxosForDustGeneration(
        nightUtxos,
        this.walletCtx.unshieldedKeystore.getPublicKey(),
        (payload: Uint8Array) => this.walletCtx.unshieldedKeystore.signData(payload),
      );
      await this.walletCtx.wallet.submitTransaction(
        await this.walletCtx.wallet.finalizeRecipe(recipe),
      );
      console.log('NIGHT UTXOs registered for dust generation successfully.');
    } catch (regErr) {
      console.error('Failed to register NIGHT UTXOs for dust generation:', regErr);
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
