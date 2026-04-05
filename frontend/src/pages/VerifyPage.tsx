import { useEffect, useState } from 'react';
import { ExternalLink, Lock, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';
import type { SolvencyStatus } from '../lib/reserve';

type VerifyResult = {
  protocolName: string;
  solvencyStatus: SolvencyStatus;
  reserveRatio?: string;
  verified: boolean;
  categoryType?: string | null;
  attributesResults?: Record<
    string,
    { label?: string; pass?: boolean; output?: string; enabled?: boolean; required?: boolean }
  > | null;
  attributes?: Array<{ name: string; verified: boolean }>;
  overallVerified?: boolean | null;
  issuedAt: string;
  expiresAt: string;
  proofHash: string;
  onChain?: boolean;
  ratioBand?: string;
  txHash?: string | null;
  networkId?: string;
};

type AuditEntry = {
  proofHash: string;
  solvencyStatus: SolvencyStatus;
  categoryType: string | null;
  createdAt: string;
  expiresAt: string;
  onChain: boolean;
  txHash: string | null;
};

type RecentVerification = {
  hash: string;
  at: number;
};

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.max(1, Math.floor(diff / (1000 * 60)));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get('view'); // null | 'auditor' | 'regulator' | 'public'
  const effectiveView: 'public' | 'auditor' | 'regulator' =
    viewParam === 'auditor' ? 'auditor' : viewParam === 'regulator' ? 'regulator' : 'public';
  const [proofHash, setProofHash] = useState(searchParams.get('hash') ?? '');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentVerified, setRecentVerified] = useState<RecentVerification[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [sampleHashes, setSampleHashes] = useState<string[]>([
    '93330f322ef88c31a6ef87cbf32d7229d451618b',
    'c1670d3a1804c32f6db8a88fd7718d22d339ecb',
  ]);

  async function verify(targetHash?: string) {
    const hash = (targetHash ?? proofHash).trim();
    if (!hash) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const verifyUrl = viewParam
        ? `${API_ENDPOINTS.RESERVE.VERIFY}?view=${encodeURIComponent(viewParam)}`
        : API_ENDPOINTS.RESERVE.VERIFY;
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofHash: hash }),
      });
      if (!response.ok) throw new Error('Proof not found');
      const payload = await response.json();
      setResult(payload);
      setRecentVerified((prev) => {
        const next = [{ hash: payload.proofHash as string, at: Date.now() }, ...prev.filter((item) => item.hash !== payload.proofHash)];
        return next.slice(0, 3);
      });
      // Fetch audit trail for this protocol
      if (payload.protocolName) {
        setAuditLoading(true);
        setAuditTrail([]);
        fetch(API_ENDPOINTS.RESERVE.PROTOCOL_HISTORY(payload.protocolName as string))
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((data) => setAuditTrail((data.history ?? []) as AuditEntry[]))
          .catch(() => setAuditTrail([]))
          .finally(() => setAuditLoading(false));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch(API_ENDPOINTS.RESERVE.FEED)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data) => {
        const hashes = (data.feed ?? [])
          .map((item: { proofHash?: string }) => item.proofHash)
          .filter(Boolean)
          .slice(0, 2);
        if (hashes.length >= 2) {
          setSampleHashes(hashes);
        }
      })
      .catch(() => {
        // Keep fallback hashes.
      });

    if (proofHash) {
      verify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useSample(hash: string) {
    setProofHash(hash);
    verify(hash);
  }

  const requiredFailed = Boolean(
    result?.attributesResults &&
      Object.values(result.attributesResults).some(
        (attribute) => attribute.required && attribute.pass === false,
      ),
  );

  const proofVerified = Boolean(result && result.verified && !requiredFailed);

  const explanationByCategory: Record<
    string,
    Array<{ label: string; description: string }>
  > = {
    exchange: [
      {
        label: 'RESERVE RATIO',
        description:
          'Proven that total reserves exceed customer liabilities without revealing wallet addresses or exact balances.',
      },
      {
        label: 'FUND SEGREGATION',
        description:
          'Customer funds are mathematically proven to be separate from operational funds.',
      },
      {
        label: 'OPERATIONAL RUNWAY',
        description:
          'Proven 6+ months of operational funding exists. Exact burn rate and treasury size remain private.',
      },
    ],
    defi: [
      {
        label: 'RESERVE RATIO',
        description:
          'Total protocol reserves exceed liabilities. No wallet addresses or exact figures revealed.',
      },
      {
        label: 'LIQUIDITY DEPTH',
        description:
          'Liquidity pools are sufficiently funded relative to TVL. Exact amounts never disclosed.',
      },
      {
        label: 'COLLATERAL RATIO',
        description:
          'All loans are backed by sufficient collateral above safe thresholds.',
      },
      {
        label: 'SMART CONTRACT AUDITED',
        description:
          'An independent audit was completed with zero critical issues. Auditor identity remains private.',
      },
    ],
    nft: [
      {
        label: 'TREASURY FUNDED',
        description:
          'Sufficient funds exist to deliver the project roadmap. Exact treasury balance never revealed.',
      },
      {
        label: 'TEAM ALLOCATION LOCKED',
        description:
          'Team tokens or funds are locked for 12+ months. No early withdrawal is possible.',
      },
      {
        label: 'SMART CONTRACT AUDITED',
        description:
          'NFT contract audited with zero critical vulnerabilities. Auditor identity private.',
      },
    ],
    airdrop: [
      {
        label: 'TREASURY SOLVENT',
        description:
          'Operational funds cover full airdrop costs. Exact amounts never disclosed.',
      },
      {
        label: 'TEAM TOKENS LOCKED',
        description:
          'Team allocation has a proven vesting period. No day-1 dump is possible.',
      },
      {
        label: 'TOKEN SUPPLY COMMITTED',
        description:
          'Total token supply is fixed. Inflation or additional minting is provably impossible.',
      },
    ],
    dao: [
      {
        label: 'TREASURY SOLVENCY',
        description:
          'DAO treasury can cover all committed expenditures. Exact balance never revealed.',
      },
      {
        label: 'OPERATIONAL RUNWAY',
        description:
          '6+ months of operational funding confirmed. Burn rate remains private.',
      },
      {
        label: 'MULTI-SIG CONTROLLED',
        description:
          'Treasury requires multiple signers. Single point of failure risk is eliminated.',
      },
      {
        label: 'CONTRIBUTOR PAY BACKED',
        description:
          'Contributor payments are funded for the next quarter. Individual salaries never disclosed.',
      },
    ],
    lending: [
      {
        label: 'RESERVE RATIO',
        description:
          'Total reserves exceed liabilities. Depositor funds are provably backed.',
      },
      {
        label: 'COLLATERAL RATIO',
        description:
          'All loans are overcollateralized above safe thresholds. Exact loan sizes private.',
      },
      {
        label: 'BAD DEBT RATIO',
        description:
          'Bad debt is proven to be below 5% of total loans. No exact figures revealed.',
      },
      {
        label: 'SMART CONTRACT AUDITED',
        description: 'Lending contracts audited with zero critical issues.',
      },
    ],
  };

  const activeExplanations =
    result?.categoryType && explanationByCategory[result.categoryType]
      ? explanationByCategory[result.categoryType]
      : null;

  return (
    <main className="page-shell mx-auto grid max-w-[1200px] gap-0 px-6 pb-12 pt-[52px] lg:grid-cols-[1fr_1px_1fr]">
      <section className="flex h-[calc(100vh-52px)] flex-col justify-center pr-0 lg:pr-16">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">Verify a Reserve Proof</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Anyone can verify. No wallet required.</p>

        <div className="mt-6 flex">
          <input
            value={proofHash}
            onChange={(e) => setProofHash(e.target.value.trim())}
            className="h-12 w-full rounded-l-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            placeholder="Paste proof hash"
          />
          <button
            onClick={() => verify()}
            className="h-12 rounded-r-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            disabled={!proofHash || loading}
          >
            {loading ? 'Verifying...' : 'Verify →'}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-[rgba(220,38,38,0.3)] bg-[var(--insolvent-bg)] px-3 py-2 text-sm text-[var(--insolvent)]">
            {error}
          </p>
        )}

        {result && (
          <div className="surface-card mt-4 p-5 route-fade">
            {/* View-level banners */}
            {effectiveView === 'auditor' && (
              <div
                className="mb-3 rounded-[8px] border border-[var(--accent)] px-4 py-2.5"
                style={{ background: 'rgba(108,99,255,0.1)' }}
              >
                <p className="text-[12px] font-medium text-[var(--accent)]">
                  🔍 AUDITOR VIEW — Attribute-level disclosure
                </p>
              </div>
            )}
            {effectiveView === 'regulator' && (
              <div
                className="mb-3 rounded-[8px] border border-[var(--solvent)] px-4 py-2.5"
                style={{ background: 'rgba(0,211,149,0.1)' }}
              >
                <p className="text-[12px] font-medium text-[var(--solvent)]">
                  🏛️ REGULATOR VIEW — Compliance disclosure
                </p>
              </div>
            )}

            {/* Verified badge */}
            <span
              className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] ${
                proofVerified
                  ? 'border-[var(--solvent-border)] bg-[var(--solvent-bg)] text-[var(--solvent)]'
                  : 'border-[rgba(220,38,38,0.3)] bg-[var(--insolvent-bg)] text-[var(--insolvent)]'
              }`}
            >
              {proofVerified ? 'VERIFIED' : 'UNVERIFIED'}
            </span>
            <p className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{result.protocolName}</p>
            {result.categoryType && (
              <p className="mt-1 inline-flex rounded-[4px] bg-[var(--accent-dim)] px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-[var(--accent)]">
                {result.categoryType}
              </p>
            )}
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <ShieldCheck size={12} className="text-[var(--accent)]" />
              Verified on Midnight Network
            </p>

            {/* Public: no attributes — nudge to request access */}
            {effectiveView === 'public' && (
              <p className="mt-3 text-[11px] italic text-[var(--text-muted)]">
                Request auditor access for attribute-level details.
              </p>
            )}

            {/* Auditor + Regulator: attribute pass/fail list */}
            {(effectiveView === 'auditor' || effectiveView === 'regulator') &&
              result.attributes && result.attributes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {result.attributes.map((attr) => (
                    <div key={attr.name} className="flex items-center justify-between text-xs">
                      <p className="text-[var(--text-primary)]">{attr.name}</p>
                      <p className={attr.verified ? 'text-[var(--solvent)]' : 'text-[var(--warning)]'}>
                        {attr.verified ? '✅ Verified' : '⚠ Check'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

            {/* Regulator-only: ratio band + network + ZK note */}
            {effectiveView === 'regulator' && (
              <div className="mt-3 space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2,var(--surface))] p-3">
                {result.ratioBand && (
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-[var(--text-muted)]">Reserve Band</p>
                    <p className="font-medium text-[var(--text-primary)]">{result.ratioBand}</p>
                  </div>
                )}
                {result.networkId && (
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-[var(--text-muted)]">Network</p>
                    <p className="font-medium text-[var(--text-primary)]">Midnight ({result.networkId})</p>
                  </div>
                )}
                {result.txHash && (
                  <a
                    href={`https://preprod.midnightexplorer.com/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
                  >
                    <ExternalLink size={10} />
                    View on Midnight Explorer
                  </a>
                )}
                <p className="text-[11px] italic text-[var(--text-muted)]">
                  Raw financial figures are mathematically excluded by the ZK circuit. Only ratio bands are available even at regulator access level.
                </p>
              </div>
            )}

            <p className="mt-2 text-xs text-[var(--text-muted)]">Issued: {new Date(result.issuedAt).toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Expires: {new Date(result.expiresAt).toLocaleString()}</p>
            <p className="mt-2 font-mono text-xs text-[var(--accent)]">{result.proofHash}</p>
          </div>
        )}

        {/* ── Audit Trail ── */}
        {result && (
          <section className="mt-8">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Audit Trail
              </p>
              {!auditLoading && auditTrail.length > 0 && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)]">
                  {auditTrail.length} proof{auditTrail.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="mb-4 text-[12px] text-[var(--text-muted)]">Proof history for this protocol</p>

            {auditLoading && (
              <p className="mt-4 text-xs text-[var(--text-muted)]">Loading history…</p>
            )}

            {!auditLoading && auditTrail.length === 0 && (
              <p className="mt-4 text-[12px] italic text-[var(--text-muted)]">
                This is the first proof from this protocol. Check back to see consistency over time.
              </p>
            )}

            {!auditLoading && auditTrail.length > 0 && (
              <div className="mt-4 space-y-0">
                {auditTrail.map((entry, idx) => {
                  const isCurrent = entry.proofHash === result.proofHash;
                  const isVerified = entry.solvencyStatus !== 'INSOLVENT';
                  const isLast = idx === auditTrail.length - 1;
                  return (
                    <div key={entry.proofHash} className="relative pl-6">
                      {/* Vertical line */}
                      {!isLast && (
                        <div
                          className="absolute w-px"
                          style={{
                            left: '7px',
                            top: '12px',
                            bottom: '-12px',
                            background: 'linear-gradient(to bottom, transparent, var(--border) 10%, var(--border) 90%, transparent)'
                          }}
                        />
                      )}

                      {/* Timeline dot */}
                      <div
                        className="absolute rounded-full"
                        style={{
                          left: isCurrent ? '-1px' : '0',
                          top: isCurrent ? '15px' : '16px',
                          width: isCurrent ? '16px' : '14px',
                          height: isCurrent ? '16px' : '14px',
                          border: `2px solid ${isCurrent ? 'var(--accent)' : 'var(--bg)'}`,
                          background: isCurrent ? 'var(--bg)' : (isVerified ? 'var(--solvent)' : 'var(--insolvent)'),
                          boxShadow: isCurrent
                            ? '0 0 10px rgba(108,99,255,0.5)'
                            : isVerified ? '0 0 8px rgba(0,211,149,0.4)' : '0 0 8px rgba(255,77,77,0.3)',
                          zIndex: 10,
                        }}
                      />

                      {/* Card */}
                      <div
                        className="mb-3 ml-3 rounded-[10px] p-[14px_16px] transition-colors duration-150"
                        style={{
                          background: isCurrent ? 'rgba(108,99,255,0.05)' : 'var(--surface)',
                          border: `1px solid ${isCurrent ? 'rgba(108,99,255,0.4)' : 'var(--border)'}`,
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrent) e.currentTarget.style.borderColor = 'var(--border-hover)';
                          else e.currentTarget.style.borderColor = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrent) e.currentTarget.style.borderColor = 'var(--border)';
                          else e.currentTarget.style.borderColor = 'rgba(108,99,255,0.4)';
                        }}
                      >
                        {/* Row 1: status badge + CURRENT pill + date */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span
                              className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${
                                entry.solvencyStatus === 'SOLVENT'
                                  ? 'border-[var(--solvent-border)] bg-[var(--solvent-bg)] text-[var(--solvent)]'
                                  : entry.solvencyStatus === 'WARNING'
                                  ? 'border-[rgba(255,184,0,0.3)] bg-[rgba(255,184,0,0.08)] text-[var(--warning)]'
                                  : 'border-[rgba(220,38,38,0.3)] bg-[var(--insolvent-bg)] text-[var(--insolvent)]'
                              }`}
                            >
                              {entry.solvencyStatus}
                            </span>
                            {isCurrent && (
                              <span
                                className="ml-1.5 inline-flex items-center rounded-[4px] border border-[var(--accent)] bg-[var(--accent-dim)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--accent)]"
                              >
                                CURRENT
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-[var(--text-muted)]">
                            {new Date(entry.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {/* Row 2: category pill + proof hash */}
                        <div className="mt-2 flex items-center gap-2">
                          {entry.categoryType && (
                            <span
                              className="inline-flex items-center rounded-[4px] border border-[rgba(108,99,255,0.2)] bg-[var(--accent-dim)] px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-[var(--accent)]"
                            >
                              {entry.categoryType}
                            </span>
                          )}
                          <span className="flex-1 font-mono text-[11px] text-[var(--text-muted)]">
                            {entry.proofHash.slice(0, 8)}…{entry.proofHash.slice(-6)}
                          </span>
                        </div>

                        {/* Row 3: on-chain link */}
                        {entry.onChain && entry.txHash && (
                          <div className="mt-2 flex items-center gap-1">
                            <ExternalLink size={10} className="text-[var(--accent)]" />
                            <a
                              href={`https://preprod.midnightexplorer.com/tx/${entry.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium text-[var(--accent)] no-underline hover:underline"
                            >
                              View on Midnight Explorer
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Lock size={12} />
          Raw financial data is never revealed in verification.
        </p>

        <section className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Try a Sample Proof</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sampleHashes.map((hash) => (
              <button
                key={hash}
                onClick={() => useSample(hash)}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--accent)] hover:border-[var(--accent)]"
              >
                {hash.slice(0, 10)}...{hash.slice(-8)}
              </button>
            ))}
          </div>
        </section>

        {recentVerified.length > 0 && (
          <section className="mt-8">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Recently Verified</p>
            <div className="mt-3 space-y-2">
              {recentVerified.map((item) => (
                <div key={item.hash} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--solvent)]" />
                    <span className="font-mono text-xs text-[var(--text-secondary)]">{item.hash.slice(0, 10)}...{item.hash.slice(-8)}</span>
                  </div>
                  <span className="inline-flex items-center rounded-[4px] border border-[var(--solvent-border)] bg-[var(--solvent-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--solvent)]">
                    VERIFIED
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{timeAgo(item.at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>

      <div className="hidden bg-[var(--border)] lg:block" />

      <section className="flex h-[calc(100vh-52px)] flex-col justify-center pl-0 lg:pl-16">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--text-muted)]">
          {activeExplanations ? 'WHAT THIS PROOF MEANS' : 'WHAT GETS VERIFIED'}
        </p>
        <div className="mt-6 space-y-0">
          {activeExplanations ? (
            activeExplanations.map((item) => (
              <article key={item.label} className="mb-6 border-l-2 border-[var(--accent-dim)] pl-4">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--accent)]">
                  {item.label}
                </p>
                <p className="text-[13px] leading-6 text-[var(--text-secondary)]">{item.description}</p>
              </article>
            ))
          ) : (
            <>
              <article className="mb-6 border-l-2 border-[var(--border)] pl-4">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--accent)]">
                  SOLVENCY STATUS
                </p>
                <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
                  Whether reserves exceed liabilities — confirmed by cryptographic proof, not by trust.
                </p>
              </article>
              <article className="mb-6 border-l-2 border-[var(--border)] pl-4">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--accent)]">
                  RATIO BAND
                </p>
                <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
                  The reserve ratio range (Above 120%, 100–120%, or Below 100%) without exposing the exact figure.
                </p>
              </article>
              <article className="mb-6 border-l-2 border-[var(--border)] pl-4">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--accent)]">
                  PROOF VALIDITY
                </p>
                <p className="text-[13px] leading-6 text-[var(--text-secondary)]">
                  That the proof was generated on Midnight Network and has not been tampered with or expired.
                </p>
              </article>
            </>
          )}
        </div>

        <div className="mt-auto rounded-lg border border-[rgba(124,111,205,0.2)] bg-[var(--accent-dim)] p-4">
          <p className="inline-flex items-start gap-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            Raw financial figures are mathematically excluded from verification. Midnight Network&apos;s ZK proof system makes it impossible to reverse engineer actual reserve values.
          </p>
        </div>
      </section>
    </main>
  );
}
