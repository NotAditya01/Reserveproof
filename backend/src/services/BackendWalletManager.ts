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

    // The Midnight SDK REQUIRES a full sync to discover UTXOs (including tDUST).
    // Without this, balanceUnboundTransaction will fail with 'Insufficient Funds'
    // even if you have tDUST on-chain. This is confirmed by Midnight docs.
    //
    // On a 4-core Azure P2V3, this takes ~2-5 minutes on a cold start.
    // We give it up to 10 minutes. The server is already listening (Azure won't kill us).
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
      await Promise.race([
        this.walletCtx.wallet.waitForSyncedState(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Wallet sync timed out after 10 minutes')), 600000)
        ),
      ]);
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
      console.log(`Full wallet sync complete in ${elapsed}s.`);
    } catch (e) {
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
      console.warn(`Wallet sync warning after ${elapsed}s: ${e instanceof Error ? e.message : String(e)}`);
      console.warn('Will attempt to proceed — proof generation may fail if tDUST UTXOs were not found.');
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
