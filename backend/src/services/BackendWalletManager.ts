import * as Rx from 'rxjs';
import { createMidnightWallet, createProviders } from './midnight-utils.js';

class BackendWalletManagerImpl {
  private walletCtx: any = null;
  private providers: any = null;
  private seed: string = '';
  private stateSubscription: Rx.Subscription | null = null;
  private isReconnecting: boolean = false;

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
    console.log('Initializing backend wallet...');
    try {
      await this.connect();
      console.log('Backend wallet ready. Server starting...');
    } catch (error) {
      console.error('FATAL ERROR: Failed to initialize backend wallet.');
      console.error(error);
      process.exit(1);
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
    
    // Wait for initial sync
    await Rx.firstValueFrom(
      this.walletCtx.wallet.state().pipe(
        Rx.throttleTime(3000),
        Rx.filter((s: any) => s.isSynced),
      ),
    );

    this.providers = await createProviders(this.walletCtx);

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
