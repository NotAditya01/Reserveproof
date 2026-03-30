import { Link, NavLink } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { useWallet } from '../context/WalletContext';

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `relative inline-flex items-center rounded-md border-b-2 px-[10px] py-1 text-sm ${
    isActive
      ? 'border-[var(--accent)] bg-[rgba(124,111,205,0.08)] text-[var(--text-primary)]'
      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
  }`;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Navbar() {
  const { walletAddress, connectWallet, disconnectWallet, loading } = useWallet();
  const [notice, setNotice] = useState<string | null>(null);

  function onDashboardClick(event: MouseEvent<HTMLAnchorElement>) {
    if (walletAddress) return;
    event.preventDefault();
    setNotice('Connect wallet to access dashboard');
    window.setTimeout(() => setNotice(null), 2200);
  }

  async function onConnect() {
    const address = await connectWallet();
    if (!address) {
      setNotice('Unable to connect wallet');
      window.setTimeout(() => setNotice(null), 2200);
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-[48px] border-b border-[rgba(255,255,255,0.09)] bg-[rgba(15,15,26,0.55)] shadow-[0_8px_30px_rgba(0,0,0,0.32)] backdrop-blur-[20px]">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        <Link to="/" className="inline-flex items-center gap-2 font-['Syne',sans-serif] text-[16px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">
          <Shield size={14} className="text-[var(--accent)]" />
          ReserveProof
        </Link>
        <div className="flex h-full items-center gap-3">
          <NavLink to="/dashboard" className={navLinkClass} onClick={onDashboardClick}>
            Dashboard
          </NavLink>
          <NavLink to="/attest" className={navLinkClass}>
            Attest
          </NavLink>
          <NavLink to="/verify" className={navLinkClass}>
            Verify
          </NavLink>
          {!walletAddress ? (
            <button
              onClick={onConnect}
              disabled={loading}
              className="rounded-md border border-[var(--accent)] bg-[var(--accent-dim)] px-[14px] py-[6px] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--accent)] disabled:opacity-60"
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <button
              onClick={disconnectWallet}
              className="rounded-md border border-[var(--accent)] bg-[var(--accent-dim)] px-[14px] py-[6px] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--accent)]"
            >
              {shortAddress(walletAddress)}
            </button>
          )}
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
