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
    console.log('Dust is a SHIELDED resource — the SDK must sync shielded chain history to find it.');
    console.log('This can take 10-20 minutes on cold starts with no persistent state.');

    const syncStart = Date.now();

    // Log progress every 15 seconds — include ALL three wallet components
    const progressSub = this.walletCtx.wallet.state().pipe(
      Rx.throttleTime(15000),
    ).subscribe((s: any) => {
      const uSync = s.unshielded?.progress?.isStrictlyComplete?.() === true;
      const sSync = s.shielded?.progress?.isStrictlyComplete?.() === true;
      const dSync = s.dust?.progress?.isStrictlyComplete?.() === true;
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(0);
      // Also try to read dust balance even if not fully synced
      let dustBal = 'n/a';
      try {
        const b = s.dust?.walletBalance?.(new Date());
        if (b !== undefined && b !== null) dustBal = String(b);
      } catch { /* ignore */ }
      console.log(`[Sync ${elapsed}s] Unshielded: ${uSync} | Shielded: ${sSync} | Dust: ${dSync} | DustBal: ${dustBal}`);
    });

    try {
      // Phase 1: Wait for unshielded sync (fast — always works in <10s)
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

      // Log NIGHT balance
      try {
        const freshState: any = await Rx.firstValueFrom(this.walletCtx.wallet.state());
        const nightBalance = freshState.unshielded?.balances?.[ledger.unshieldedToken().raw] ?? 0n;
        console.log(`NIGHT balance: ${nightBalance}`);
      } catch (e) {
        console.warn('Could not read NIGHT balance:', e);
      }

      // Phase 2: Wait for FULL sync (shielded + dust) using the SDK's own method.
      // This is critical — without this, balanceUnboundTransaction WILL fail with
      // "Insufficient Funds: could not balance dust" because dust UTXOs are shielded
      // and require the full shielded chain history to be synced.
      //
      // On Azure with no persistent state, this takes 10-20 minutes.
      // The server is already listening and serving /healthz, so Azure won't kill us.
      const FULL_SYNC_TIMEOUT_MS = 900000; // 15 minutes
      console.log(`Waiting up to ${FULL_SYNC_TIMEOUT_MS / 60000} minutes for full wallet sync (shielded + dust)...`);

      try {
        await Promise.race([
          this.walletCtx.wallet.waitForSyncedState(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Full wallet sync timed out')), FULL_SYNC_TIMEOUT_MS)
          ),
        ]);
        const fullElapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
        console.log(`✓ Full wallet sync complete in ${fullElapsed}s! Shielded + Dust synced.`);
      } catch (syncErr) {
        const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
        console.error(`✗ Full wallet sync failed after ${elapsed}s: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`);
        console.warn('⚠ Proof generation WILL FAIL with "Insufficient Funds: could not balance dust"');
        console.warn(`→ The wallet has dust on-chain but the SDK cannot discover it without shielded sync.`);
        console.warn(`→ Wallet address: ${walletAddress}`);
        console.warn('→ Options: (1) Wait longer, (2) Use persistent storage, (3) Run locally');
      }
    } catch (e) {
      const elapsed = ((Date.now() - syncStart) / 1000).toFixed(1);
      console.error(`Critical: Wallet sync failed after ${elapsed}s: ${e instanceof Error ? e.message : String(e)}`);
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
