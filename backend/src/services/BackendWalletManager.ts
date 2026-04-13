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
      console.log('Backend wallet fully synced and ready for proof generation.');
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

    const walletAddress = this.walletCtx.unshieldedKeystore.getBech32Address();
    console.log(`Backend wallet address: ${walletAddress}`);
    console.log('Syncing with Midnight Network...');

    const syncStart = Date.now();

    // Log progress every 15 seconds — include ALL three wallet components
    const progressSub = this.walletCtx.wallet.state().pipe(
      Rx.throttleTime(15000),
    ).subscribe((s: any) => {
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(0);
      const uSync = s.unshielded?.progress?.isStrictlyComplete?.() === true;
      const sSync = s.shielded?.progress?.isStrictlyComplete?.() === true;
      const dSync = s.dust?.progress?.isStrictlyComplete?.() === true;
      const isSynced = s.isSynced === true;
      let dustBal = 'n/a';
      try {
        const b = s.dust?.walletBalance?.(new Date());
        if (b !== undefined && b !== null) dustBal = String(b);
      } catch { /* ignore */ }
      console.log(`[Sync ${elapsed}s] isSynced: ${isSynced} | Unshielded: ${uSync} | Shielded: ${sSync} | Dust: ${dSync} | DustBal: ${dustBal}`);
    });

    try {
      // Use state.isSynced instead of isStrictlyComplete().
      //
      // CRITICAL FIX: The "idle chain" bug causes dust.progress.isStrictlyComplete()
      // to NEVER return true on low-activity chains (like preprod).
      // The dust wallet waits for new blocks to confirm it has reached the chain tip,
      // but on idle chains, those blocks never come.
      //
      // state.isSynced is the SDK's own high-level flag that accounts for this.
      // This is what deploy.ts uses and it WORKS.
      const SYNC_TIMEOUT_MS = 600000; // 10 minutes
      console.log(`Waiting for wallet isSynced (timeout: ${SYNC_TIMEOUT_MS / 60000} min)...`);

      const syncedState: any = await Promise.race([
        Rx.firstValueFrom(
          this.walletCtx.wallet.state().pipe(
            Rx.throttleTime(3000),
            Rx.filter((s: any) => s.isSynced === true),
          ),
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Wallet isSynced timed out after ${SYNC_TIMEOUT_MS / 60000} minutes`)), SYNC_TIMEOUT_MS)
        ),
      ]);

      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
      console.log(`✓ Wallet fully synced (isSynced=true) in ${elapsed}s.`);

      // Log balances
      try {
        const nightBalance = syncedState.unshielded?.balances?.[ledger.unshieldedToken().raw] ?? 0n;
        console.log(`NIGHT balance: ${nightBalance}`);
        const dustBalance = syncedState.dust?.walletBalance?.(new Date());
        console.log(`DUST balance: ${dustBalance ?? 'unknown'}`);
      } catch (e) {
        console.warn('Could not read balances:', e);
      }
    } catch (e) {
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
      console.error(`✗ Wallet sync failed after ${elapsed}s: ${e instanceof Error ? e.message : String(e)}`);
      console.warn('⚠ Proof generation will fail: dust UTXOs not discoverable.');
      console.warn(`→ Wallet address: ${walletAddress}`);
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

  async shutdown() {
    console.log('Shutting down wallet connection...');
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }
}

export const BackendWalletManager = new BackendWalletManagerImpl();
