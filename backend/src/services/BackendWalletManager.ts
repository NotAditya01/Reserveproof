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

    // Step 1: Wait for Unshielded sync (fast — ~3 seconds)
    await Rx.firstValueFrom(
      this.walletCtx.wallet.state().pipe(
        Rx.throttleTime(3000),
        Rx.tap((s: any) => {
          const uSync = s.unshielded?.progress?.isStrictlyComplete?.() === true;
          const dSync = s.dust?.progress?.isStrictlyComplete?.() === true;
          console.log(`[Wallet Sync] Unshielded: ${uSync} | Dust: ${dSync}`);
        }),
        Rx.filter((s: any) => s.unshielded?.progress?.isStrictlyComplete?.() === true),
      ),
    );
    console.log('Unshielded sync complete.');

    // Step 2: Wait for Dust wallet to discover tDUST balance (up to 2 min)
    // We do NOT wait for isStrictlyComplete (never finishes on Azure).
    // We just wait until the wallet finds a non-zero tDUST balance.
    console.log('Waiting for Dust wallet to discover tDUST balance...');
    try {
      await Rx.firstValueFrom(
        this.walletCtx.wallet.state().pipe(
          Rx.throttleTime(5000),
          Rx.tap((s: any) => {
            const bal = s.dust?.walletBalance?.(new Date());
            console.log(`[Dust Balance] ${bal ?? 'unknown'}`);
          }),
          Rx.filter((s: any) => {
            const bal = s.dust?.walletBalance?.(new Date());
            return typeof bal === 'bigint' && bal > 0n;
          }),
          Rx.timeout(120000),
        ),
      );
      console.log('Dust wallet has tDUST — ready for transactions.');
    } catch (e) {
      console.warn('Dust balance not found within 2 minutes. Proof generation may fail with Insufficient Funds.');
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
