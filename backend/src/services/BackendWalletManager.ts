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

    // Midnight SDK sync strategy:
    // - waitForSyncedState() blocks until ALL sub-wallets (shielded, unshielded, dust) complete.
    // - In practice, dust sync often NEVER completes because:
    //   (a) Dust generation requires prior NIGHT UTXO registration (done in deploy.ts)
    //   (b) The indexer may not return dust progress on cold starts
    //   (c) The dust wallet depends on shielded state which itself can be slow
    //
    // Fix: Wait only for unshielded sync (always completes in ~10s), then give dust a
    // short window to catch up. If dust doesn't sync, proceed anyway — the SDK can
    // still discover tDUST UTXOs lazily when balanceUnboundTransaction is called,
    // as long as registration was done previously (in deploy.ts).
    const syncStart = Date.now();

    // Log progress every 10 seconds so we can see it's working
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

      // Phase 2: Give dust wallet a shorter window to sync (nice-to-have, not blocking)
      const DUST_TIMEOUT_MS = 90000; // 90 seconds
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
        console.warn(`Dust sync did not complete within ${DUST_TIMEOUT_MS / 1000}s (total ${dElapsed}s). Proceeding — dust UTXOs will be discovered lazily.`);
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

  async shutdown() {
    console.log('Shutting down wallet connection...');
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }
}

export const BackendWalletManager = new BackendWalletManagerImpl();
