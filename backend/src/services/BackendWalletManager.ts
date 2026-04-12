import * as Rx from 'rxjs';
import fs from 'fs';
import { createMidnightWallet, createProviders } from './midnight-utils.js';

class BackendWalletManagerImpl {
  private walletCtx: any = null;
  private providers: any = null;
  private seed: string = '';
  private stateSubscription: Rx.Subscription | null = null;
  private isReconnecting: boolean = false;
  public isReady: boolean = false;
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
    
    // Wait for initial sync (Unshielded + Dust)
    console.log('Performing deep sync with Midnight indexer...');
    await Rx.firstValueFrom(
      this.walletCtx.wallet.state().pipe(
        Rx.throttleTime(3000),
        Rx.tap((s: any) => {
           const unshieldedS = s.unshielded?.progress?.isStrictlyComplete?.() === true;
           const dustS = s.dust?.progress?.isStrictlyComplete?.() === true;
           
           // Extract block height for better monitoring
           const currentHeight = s.unshielded?.progress?.syncHeight ?? 'unknown';
           const totalHeight = s.unshielded?.progress?.tipHeight ?? 'unknown';
           
           this.syncProgress = unshieldedS && dustS ? '100%' : (unshieldedS ? '50%' : '10%');
           console.log(`[Wallet Sync] Height: ${currentHeight}/${totalHeight} | Unshielded Ready: ${unshieldedS} | Dust Ready: ${dustS}`);
        }),
        Rx.filter((s: any) => {
          const isUnshieldedSynced = s.unshielded?.progress?.isStrictlyComplete?.() === true;
          const isDustSynced = s.dust?.progress?.isStrictlyComplete?.() === true;
          return isUnshieldedSynced && isDustSynced;
        }),
      ),
    );

    this.providers = await createProviders(this.walletCtx);
    this.isReady = true;
    console.log('Backend wallet fully synced and providers ready.');

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
    // Perform any SDK specific close hooks if they exist on walletCtx
  }
}

export const BackendWalletManager = new BackendWalletManagerImpl();
