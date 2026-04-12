import * as Rx from 'rxjs';
import { createMidnightWallet, createProviders } from './midnight-utils.js';

class BackendWalletManagerImpl {
  private walletCtx: any = null;
  private providers: any = null;
  private seed: string = '';
  private stateSubscription: Rx.Subscription | null = null;
  private syncSubscription: Rx.Subscription | null = null;
  private isReconnecting: boolean = false;
  public isReady: boolean = false;
  public isDustReady: boolean = false;
  public syncProgress: string = '0%';

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
      console.log('Backend wallet background sync initiated.');
    } catch (error) {
      console.error('ERROR: Failed to initiate backend wallet background sync.');
      console.error(error);
      // We do not exit(1) here to allow the server to stay alive for Azure health checks
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
    console.log('Performing deep sync with Midnight indexer...');

    const state$ = this.walletCtx.wallet.state().pipe(Rx.throttleTime(3000));

    if (this.syncSubscription) this.syncSubscription.unsubscribe();
    this.syncSubscription = state$.subscribe({
      next: (s: any) => {
        const unshieldedS = s.unshielded?.progress?.isStrictlyComplete?.() === true;
        const dustProgressReady = s.dust?.progress?.isStrictlyComplete?.() === true;
        const dustBalance = s.dust?.walletBalance?.(new Date());
        const dustBalanceReady = typeof dustBalance === 'bigint' ? dustBalance > 0n : false;
        const dustS = dustProgressReady || dustBalanceReady;

        const currentHeight = s.unshielded?.progress?.syncHeight ?? 'unknown';
        const totalHeight = s.unshielded?.progress?.tipHeight ?? 'unknown';

        this.isDustReady = dustS;
        this.syncProgress = dustS
          ? '100% (ready)'
          : unshieldedS
            ? '60% (DUST pending)'
            : '10% (syncing)';

        console.log(
          `[Wallet Sync] Height: ${currentHeight}/${totalHeight} | Unshielded Ready: ${unshieldedS} | Dust Ready: ${dustS}`,
        );
      },
      error: (err: any) => {
        console.error('Wallet sync monitor error:', err);
      },
    });

    // Wait for unshielded sync (dust may be generated later)
    await Rx.firstValueFrom(
      state$.pipe(
        Rx.filter((s: any) => s.unshielded?.progress?.isStrictlyComplete?.() === true),
      ),
    );

    this.providers = await createProviders(this.walletCtx);
    this.isReady = true;
    console.log('Backend wallet unshielded sync complete and providers ready.');

    // Ensure DUST setup in background (registration + wait)
    this.ensureDustReady().catch((err) => {
      console.warn('DUST setup failed:', err);
    });

    // Watch for disconnection
    if (this.stateSubscription) this.stateSubscription.unsubscribe();

    this.stateSubscription = this.walletCtx.wallet.state().subscribe({
      next: (state: any) => {
        // Many chain events toggle isSynced, we only want to reconnect if it gets stuck entirely
      },
      error: async (err: any) => {
        if (this.isReconnecting) return;
        this.isReconnecting = true;
        console.error('Wallet disconnected, reconnecting...');
        
        // Attempt reconnect with 5 second delay
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
         // Same reconnect hook if stream ends
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
    if (this.syncSubscription) {
      this.syncSubscription.unsubscribe();
    }
    if (this.walletCtx?.wallet?.close) {
      await this.walletCtx.wallet.close();
    }
  }

  private async ensureDustReady() {
    const state$ = this.walletCtx.wallet.state().pipe(Rx.throttleTime(5000));

    const initialState: any = await Rx.firstValueFrom(state$.pipe(Rx.first()));
    const initialDustBalance = initialState.dust?.walletBalance?.(new Date());
    if (typeof initialDustBalance === 'bigint' && initialDustBalance > 0n) {
      this.isDustReady = true;
      console.log('DUST tokens already available.');
      return;
    }

    const nightUtxos = (initialState.unshielded?.availableCoins ?? []).filter(
      (c: any) => !c.meta?.registeredForDustGeneration,
    );

    if (nightUtxos.length > 0) {
      console.log('Registering for DUST generation...');
      const recipe = await this.walletCtx.wallet.registerNightUtxosForDustGeneration(
        nightUtxos,
        this.walletCtx.unshieldedKeystore.getPublicKey(),
        (payload: Uint8Array) => this.walletCtx.unshieldedKeystore.signData(payload),
      );
      await this.walletCtx.wallet.submitTransaction(
        await this.walletCtx.wallet.finalizeRecipe(recipe),
      );
    } else {
      console.warn('No unshielded coins available for DUST registration.');
    }

    console.log('Waiting for DUST tokens...');
    const timeoutMs = Number(process.env.DUST_WAIT_TIMEOUT_MS ?? '120000');
    try {
      await Rx.firstValueFrom(
        state$.pipe(
          Rx.filter((s: any) => s.unshielded?.progress?.isStrictlyComplete?.() === true),
          Rx.filter((s: any) => {
            const bal = s.dust?.walletBalance?.(new Date());
            return typeof bal === 'bigint' && bal > 0n;
          }),
          Rx.timeout(timeoutMs),
        ),
      );
      this.isDustReady = true;
      console.log('DUST tokens ready.');
    } catch (err) {
      console.warn(`DUST not ready after ${timeoutMs}ms.`, err);
    }
  }
}

export const BackendWalletManager = new BackendWalletManagerImpl();
