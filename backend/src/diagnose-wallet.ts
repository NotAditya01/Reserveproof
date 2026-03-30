import 'dotenv/config';
import * as Rx from 'rxjs';
import { createMidnightWallet, generateSeedHex } from './services/midnight-utils.js';

async function diagnose() {
  const seed = process.env.BACKEND_WALLET_SEED || generateSeedHex();
  console.log('Creating wallet...');
  const walletCtx = await createMidnightWallet(seed);
  console.log('Subscribing...\n');
  
  let count = 0;
  const sub = walletCtx.wallet.state().pipe(
    Rx.throttleTime(5000),
  ).subscribe((s: any) => {
    count++;
    try {
      const sp = s.shielded?.state?.progress;
      const dp = s.dust?.state?.progress;
      const up = s.unshielded?.progress;
      
      const spComplete = sp?.isStrictlyComplete?.() ?? 'no-method';
      const dpComplete = dp?.isStrictlyComplete?.() ?? 'no-method';
      const upComplete = up?.isStrictlyComplete?.() ?? 'no-method';
      
      console.log(`[${count}] shielded=${spComplete} dust=${dpComplete} unshielded=${upComplete} | combined=${s.isSynced}`);
    } catch (e: any) {
      console.log(`[${count}] error reading: ${e.message}`);
    }
    
    if (s.isSynced || count >= 15) {
      if (s.isSynced) console.log('\n✅ SYNCED!');
      else console.log('\n❌ Not synced after 15 checks (~75s)');
      sub.unsubscribe();
      walletCtx.wallet.stop();
      process.exit(s.isSynced ? 0 : 1);
    }
  });
  
  setTimeout(() => { sub.unsubscribe(); walletCtx.wallet.stop(); process.exit(1); }, 120_000);
}

diagnose().catch((e) => { console.error(e.message); process.exit(1); });
