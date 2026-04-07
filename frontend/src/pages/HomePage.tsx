import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Building2, Clock3, Hash, Image, Lock, Rocket, Share2, Shield, Users, Zap } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import type { SolvencyStatus } from '../lib/reserve';
import { timeAgo } from '../lib/utils';

type FeedRow = {
  protocolName: string;
  solvencyStatus: SolvencyStatus;
  createdAt: string;
  proofHash: string;
};

function homepageStatusBadge(status: SolvencyStatus): { label: string; className: string; dotClass: string } {
  if (status === 'SOLVENT') {
    return {
      label: 'VERIFIED',
      className: 'border-[var(--solvent-border)] bg-[var(--solvent-bg)] text-[var(--solvent)]',
      dotClass: 'bg-[var(--solvent)]',
    };
  }
  if (status === 'WARNING') {
    return {
      label: 'ACTIVE',
      className: 'border-[rgba(202,138,4,0.3)] bg-[var(--warning-bg)] text-[var(--warning)]',
      dotClass: 'bg-[var(--warning)]',
    };
  }
  return {
    label: 'ATTESTED',
    className: 'border-[var(--border)] bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]',
    dotClass: 'bg-[var(--text-muted)]',
  };
}

const trustedBy = [
  { label: 'Crypto Exchanges', icon: Building2 },
  { label: 'DeFi Protocols', icon: Zap },
  { label: 'NFT Launches', icon: Image },
  { label: 'Airdrop Teams', icon: Rocket },
  { label: 'DAOs', icon: Users },
  { label: 'Lending Platforms', icon: BarChart3 },
  { label: 'Team Lockup Proofs', icon: Lock },
  { label: 'Solvency Attestations', icon: Shield },
  { label: 'Audit Verification', icon: Shield },
  { label: 'Runway Proofs', icon: BarChart3 },
  { label: 'Multi-sig Confirmation', icon: Users },
  { label: 'Collateral Proofs', icon: BarChart3 },
];

const flow = [
  {
    id: '01',
    icon: Lock,
    title: 'Commit Privately',
    description: 'Reserve and liability values are committed as private witness data and never exposed on-chain.',
  },
  {
    id: '02',
    icon: Shield,
    title: 'Generate Proof',
    description: 'Midnight computes a zero-knowledge solvency proof, publishing only verifiable commitment anchors.',
  },
  {
    id: '03',
    icon: Share2,
    title: 'Verify Anywhere',
    description: 'Anyone can verify status and proof validity while sensitive financial values remain unrecoverable.',
  },
];

export default function HomePage() {
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [isHeadlineExiting, setIsHeadlineExiting] = useState(false);

  const headlineWords = useMemo(
    () => ['Web3 Projects.', 'Crypto Exchanges.', 'DeFi Protocols.', 'NFT Launches.', 'Airdrop Teams.', 'DAOs.', 'Lending Platforms.'],
    [],
  );

  const categories = useMemo(
    () => ['DeFi Protocol', 'NFT Launch', 'DAO', 'Crypto Exchange', 'Airdrop Project', 'Lending Platform'],
    [],
  );

  useEffect(() => {
    fetch(API_ENDPOINTS.RESERVE.FEED)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load feed');
        return res.json();
      })
      .then((data) => setFeed(data.feed ?? []))
      .catch(() => setFeed([]));
  }, []);

  const baseFeed = useMemo(() => {
    const core = feed.length ? feed.slice(0, 8) : [];
    return [
      ...core,
      {
        protocolName: 'NovaDEX',
        solvencyStatus: 'INSOLVENT' as SolvencyStatus,
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        proofHash: '0a4cb1f992873cd17e8ba63995aa4bb6de0f4e3d9b6b2c51',
      },
    ];
  }, [feed]);

  const feedCards = useMemo(() => [...baseFeed, ...baseFeed], [baseFeed]);

  useEffect(() => {
    let holdTimeout: number | undefined;
    let exitTimeout: number | undefined;
    let cancelled = false;

    function cycle() {
      holdTimeout = window.setTimeout(() => {
        if (cancelled) return;
        setIsHeadlineExiting(true);
        exitTimeout = window.setTimeout(() => {
          if (cancelled) return;
          setHeadlineIndex((prev) => (prev + 1) % headlineWords.length);
          setIsHeadlineExiting(false);
          cycle();
        }, 300);
      }, 2000);
    }

    cycle();
    return () => {
      cancelled = true;
      if (holdTimeout) window.clearTimeout(holdTimeout);
      if (exitTimeout) window.clearTimeout(exitTimeout);
    };
  }, [headlineWords.length]);

  return (
    <main className="page-shell">
      <section className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-6 pb-4 pt-16 md:[grid-template-columns:auto_1fr] md:gap-[60px] md:px-[80px] md:pb-[16px] md:pt-[72px]">
        <div className="relative mx-auto flex w-fit max-w-[480px] flex-col gap-5 self-center md:mx-0">
          <span className="pointer-events-none absolute left-[-20px] top-[-40px] z-0 select-none whitespace-nowrap font-['Syne',sans-serif] text-[200px] font-black leading-none tracking-[-0.05em] text-[rgba(124,111,205,0.03)] md:text-[320px]">
            ZK
          </span>
          <p className="relative z-[1] inline-flex rounded-[99px] border border-[rgba(124,111,205,0.3)] bg-[var(--accent-dim)] px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-[var(--accent)]">
            MIDNIGHT NETWORK • ZERO KNOWLEDGE
          </p>
          <h1 className="relative z-[1] max-w-[480px] text-left font-['Syne',sans-serif] text-[38px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--text-primary)] md:whitespace-nowrap max-md:text-[28px]">
            <span>The Trust Layer for</span>
            <span className={`block italic text-[var(--accent)] ${isHeadlineExiting ? 'hero-word-exit' : 'hero-word-enter'}`}>
              {headlineWords[headlineIndex]}
            </span>
          </h1>
          <p className="relative z-[1] mt-3 max-w-[380px] text-left text-[14px] font-normal leading-[1.6] text-[var(--text-secondary)]">
            Prove trust without revealing the numbers.
            <br />
            Zero-knowledge keeps sensitive data hidden.
          </p>
          <div className="relative z-[1] mt-8 flex flex-wrap items-center justify-start gap-4">
            <Link
              to="/attest"
              className="btn px-8"
            >
              Attest Your Reserves
            </Link>
            <Link
              to="/verify"
              className="btn-outline px-8"
            >
              Verify a Proof
            </Link>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <span className="hero-proof-glow" />
          <article className="hero-proof-card">
            <div className="hero-proof-card-grid" />
            <div className="hero-proof-sheen" />
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  <Zap size={12} className="text-[var(--accent)]" />
                  DeFi Protocol
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">Midnight Network</p>
              </div>
              <span className="hero-proof-badge">
                Verified
              </span>
            </div>
            <div className="mt-6">
              <p className="text-[22px] font-black leading-none tracking-[-0.05em] text-[var(--text-primary)]">Aave Protocol</p>
            </div>
            <div className="hero-proof-divider mt-4" />
            <div className="mt-2.5 space-y-0.5">
              {['Reserve Ratio', 'Collateral Ratio', 'Liquidity Depth', 'Smart Contract Audited'].map((item, index) => (
                <div key={item} className={`hero-proof-row ${index < 3 ? 'hero-proof-row-border' : ''}`}>
                  <p className="inline-flex items-center gap-3 text-[13px] font-medium text-[var(--text-primary)]">
                    <span className="hero-proof-dot" />
                    {item}
                  </p>
                  <span className="hero-proof-status">Verified</span>
                </div>
              ))}
            </div>
            <div className="hero-proof-footer">
              <div className="hero-proof-hash">
                <div className="hero-proof-meta-inline">
                  <p className="hero-proof-meta-label">
                    <Clock3 size={10} />
                    Issued: 22/03/2026
                  </p>
                  <p className="hero-proof-meta-label">
                    <Clock3 size={10} />
                    Expires: 20/06/2026
                  </p>
                </div>
                <p className="hero-proof-meta-label mt-1.5">
                  <Hash size={10} />
                  Proof Hash
                </p>
                <p className="mt-1 font-mono text-[12px] tracking-[0.08em] text-[var(--accent-soft)]">0x7c4f...9a2e</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="w-full border-y border-[var(--border)] bg-transparent py-4">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-4 px-6 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="text-center">
            <p className="text-[20px] font-bold text-[var(--text-primary)]">2,400+</p>
            <p className="mt-0.5 text-xs uppercase tracking-[0.05em] text-[var(--text-muted)]">Proofs Generated</p>
          </div>
          <div className="mx-auto hidden h-8 w-px bg-[var(--border)] md:block" />
          <div className="text-center">
            <p className="text-[20px] font-bold text-[var(--text-primary)]">6</p>
            <p className="mt-0.5 text-xs uppercase tracking-[0.05em] text-[var(--text-muted)]">Project Categories</p>
          </div>
          <div className="mx-auto hidden h-8 w-px bg-[var(--border)] md:block" />
          <div className="text-center">
            <p className="text-[20px] font-bold text-[var(--text-primary)]">100%</p>
            <p className="mt-0.5 text-xs uppercase tracking-[0.05em] text-[var(--text-muted)]">On-Chain Verified</p>
          </div>
        </div>
      </section>

      <section className="trusted-ticker mt-2">
        <div className="trusted-ticker-track">
          {[...trustedBy, ...trustedBy].map((item, index) => (
            <div key={`${item.label}-${index}`} className="trusted-ticker-item">
              <item.icon size={13} className="text-[var(--accent)]" />
              <span className="trusted-ticker-text">{item.label}</span>
              <span className="trusted-ticker-separator" />
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 pb-20 pt-12">
        <h2 className="mb-12 text-center font-['Syne',sans-serif] text-[32px] font-black uppercase tracking-[0.15em] text-[var(--text-primary)]">
          How It Works
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {flow.map((step) => (
            <article 
              key={step.id} 
              className="group relative overflow-hidden rounded-[12px] border-[1.5px] border-[var(--border)] bg-[var(--surface)] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] hover:shadow-[0_8px_30px_rgba(108,99,255,0.1)]"
            >
              <span className="absolute right-6 top-6 font-['Syne',sans-serif] text-[48px] font-black leading-none text-[var(--text-primary)] opacity-5 transition-opacity group-hover:opacity-10">
                {step.id}
              </span>
              
              <div className="mb-6 inline-flex rounded-[12px] border border-[rgba(124,111,205,0.2)] bg-[var(--accent-dim)] p-3 text-[var(--accent)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[12deg]">
                <step.icon size={24} />
              </div>

              <h3 className="mb-3 font-['Syne',sans-serif] text-[20px] font-bold uppercase tracking-tight text-[var(--text-primary)]">
                {step.title}
              </h3>
              <p className="text-[14px] leading-[1.6] text-[var(--text-secondary)]">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-16 pt-8">
        <div className="mb-3 flex items-center gap-4">
          <p className="section-label">Live Proof Feed</p>
        </div>
        {!baseFeed.length ? (
          <p className="mt-5 text-sm text-[var(--text-secondary)]">No feed data yet. Generate your first attestation.</p>
        ) : (
          <div className="home-feed-auto">
            <div className="home-feed-track">
              {feedCards.map((row, index) => {
                const badge = homepageStatusBadge(row.solvencyStatus);
                return (
                  <article key={`${row.proofHash}-${index}`} className="home-feed-card">
                    <div className="flex items-center gap-2">
                      <span className={`h-[7px] w-[7px] rounded-full ${badge.dotClass}`} />
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{row.protocolName}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{categories[index % categories.length]}</p>
                    <span className={`mt-2.5 inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] ${badge.className}`}>
                      {badge.label}
                    </span>
                    <p className="mt-2 font-mono text-[10px] text-[var(--accent)]">{row.proofHash.slice(0, 18)}...</p>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">{timeAgo(row.createdAt)}</p>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-5 text-center text-xs text-[var(--text-muted)]">
        ReserveProof • Built on Midnight Network • 2026
      </footer>
    </main>
  );
}
