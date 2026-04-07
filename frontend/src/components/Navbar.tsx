import { Link, NavLink } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { useWallet } from '../context/WalletContext';
import { shortAddress } from '../lib/utils';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `relative font-black uppercase tracking-[0.08em] text-[13px] sm:text-[14px] transition-transform duration-200 hover:-translate-y-0.5 ${isActive
    ? 'text-[var(--accent)] drop-shadow-[0_2px_4px_rgba(124,111,205,0.4)]'
    : 'text-[var(--text-primary)] hover:text-[var(--accent)]'
    }`;
}

const buttonSmall = "btn px-[18px] py-[8px] text-[12px] sm:text-[13px]";

export default function Navbar() {
  const { walletAddress, connectWallet, disconnectWallet, loading } = useWallet();
  const [notice, setNotice] = useState<string | null>(null);

  function onDashboardClick(event: MouseEvent<HTMLAnchorElement>) {
    if (walletAddress) return;
    event.preventDefault();
    setNotice('Connect Lace wallet to access dashboard');
    window.setTimeout(() => setNotice(null), 2200);
  }

  async function onConnect() {
    const address = await connectWallet();
    if (!address) {
      setNotice('Unable to connect Lace wallet');
      window.setTimeout(() => setNotice(null), 2200);
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-[64px] border-b border-[rgba(255,255,255,0.09)] bg-[rgba(15,15,26,0.65)] shadow-[0_8px_30px_rgba(0,0,0,0.32)] backdrop-blur-[20px]">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <Link to="/" className="inline-flex items-center gap-2 font-['Syne',sans-serif] text-[16px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">
          <Shield size={14} className="text-[var(--accent)]" />
          ReserveProof
        </Link>
        <div className="flex h-full items-center gap-3 sm:gap-5">
          <NavLink to="/dashboard" className={navLinkClass} onClick={onDashboardClick}>
            Dashboard
          </NavLink>
          <span className="text-[var(--text-secondary)] opacity-40 font-black">|</span>
          <NavLink to="/attest" className={navLinkClass}>
            Attest
          </NavLink>
          <span className="text-[var(--text-secondary)] opacity-40 font-black">|</span>
          <NavLink to="/verify" className={navLinkClass}>
            Verify
          </NavLink>
          <div className="ml-2 flex sm:ml-5">
            {!walletAddress ? (
              <button
                onClick={onConnect}
                disabled={loading}
                className={buttonSmall}
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <button
                onClick={disconnectWallet}
                className={buttonSmall}
              >
                {shortAddress(walletAddress)}
              </button>
            )}
          </div>
        </div>
      </nav>
      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-[52px] -translate-x-1/2 rounded-md border border-[var(--border-hover)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
          {notice}
        </div>
      )}
    </header>
  );
}
