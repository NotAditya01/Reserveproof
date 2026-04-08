import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Check,
  CheckCircle,
  ChevronLeft,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Hash,
  Image,
  Landmark,
  LayoutDashboard,
  Link as LinkIcon,
  Rocket,
  Search,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { spawnConfetti } from '../lib/utils';

type VerifyResponse = {
  protocolName: string;
  solvencyStatus: 'SOLVENT' | 'WARNING' | 'INSOLVENT';
  reserveRatio: string;
  verified: boolean;
  categoryType?: 'exchange' | 'defi' | 'nft' | 'airdrop' | 'dao' | 'lending' | null;
  attributesResults?: Record<
    string,
    { label?: string; pass?: boolean; output?: string; enabled?: boolean }
  > | null;
  overallVerified?: boolean | null;
  issuedAt: string;
  expiresAt: string;
  proofHash: string;
  txHash?: string | null;
  onChain?: boolean;
};

const categoryMeta = {
  exchange: { label: 'Crypto Exchange', icon: Building2 },
  defi: { label: 'DeFi Protocol', icon: Zap },
  nft: { label: 'NFT Launch', icon: Image },
  airdrop: { label: 'Airdrop Project', icon: Rocket },
  dao: { label: 'DAO', icon: Users },
  lending: { label: 'Lending Platform', icon: BarChart3 },
} as const;

function shortHash(hash: string): string {
  return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
}

function verifyUrl(origin: string, hash: string): string {
  return `${origin}/verify?hash=${encodeURIComponent(hash)}`;
}

export default function AttestProofPage() {
  const navigate = useNavigate();
  const { proofHash = '' } = useParams();
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [copiedAuditorLink, setCopiedAuditorLink] = useState(false);
  const [copiedRegulatorLink, setCopiedRegulatorLink] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const response = await fetch(API_ENDPOINTS.RESERVE.VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proofHash }),
        });
        if (!response.ok) throw new Error('Proof not found');
        const payload = (await response.json()) as VerifyResponse;
        if (!mounted) return;
        setData(payload);
        if (payload.overallVerified ?? payload.verified) {
          spawnConfetti();
        }
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load proof');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [proofHash]);

  const verifyLink = useMemo(
    () => verifyUrl(window.location.origin, proofHash),
    [proofHash],
  );

  const overallVerified = (data?.overallVerified ?? data?.verified) ?? false;
  const categoryType = data?.categoryType ?? null;
  const category = categoryType ? categoryMeta[categoryType] : null;
  const CategoryIcon = category?.icon ?? ShieldCheck;
  const categoryLabel = category?.label ?? 'Reserve Proof';
  const attributeRows = data?.attributesResults ? Object.values(data.attributesResults) : [];

  async function copyVerifyLink() {
    await navigator.clipboard.writeText(verifyLink);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  }

  async function copyProofHash() {
    await navigator.clipboard.writeText(proofHash);
    setCopiedHash(true);
    window.setTimeout(() => setCopiedHash(false), 2000);
  }

  const auditorLink = verifyUrl(window.location.origin, proofHash) + '&view=auditor';
  const regulatorLink = verifyUrl(window.location.origin, proofHash) + '&view=regulator';

  async function copyPublicLink() {
    await navigator.clipboard.writeText(verifyLink);
    setCopiedPublicLink(true);
    window.setTimeout(() => setCopiedPublicLink(false), 2000);
  }

  async function copyAuditorLink() {
    await navigator.clipboard.writeText(auditorLink);
    setCopiedAuditorLink(true);
    window.setTimeout(() => setCopiedAuditorLink(false), 2000);
  }

  async function copyRegulatorLink() {
    await navigator.clipboard.writeText(regulatorLink);
    setCopiedRegulatorLink(true);
    window.setTimeout(() => setCopiedRegulatorLink(false), 2000);
  }

  function shareX() {
    const text =
      'I just generated a ZK proof of solvency on @MidnightNtwrk with ReserveProof. No financial data revealed. Verify it here: ' +
      verifyLink;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }

  function shareTelegram() {
    const text = 'Verify my ZK proof of solvency on Midnight Network — no financial data revealed.';
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(verifyLink)}&text=${encodeURIComponent(text)}`,
      '_blank',
    );
  }

  if (loading) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-52px)] place-items-center px-6">
        <div className="text-center">
          <div
            className="mx-auto h-8 w-8 rounded-full border-2 border-[var(--surface-2)] border-t-[var(--accent)]"
            style={{ animation: 'spin 0.8s linear infinite' }}
          />
          <p className="mt-4 text-sm text-[var(--text-muted)]">Loading your proof...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto grid min-h-[calc(100vh-52px)] place-items-center px-6">
        <p className="text-sm text-[var(--insolvent)]">{error ?? 'Proof not found'}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-52px)] max-w-[560px] flex-col items-center gap-6 px-6 py-12">
      <button
        onClick={() => navigate('/attest')}
        className="btn-outline px-3 py-1.5 text-[12px]"
      >
        <ChevronLeft size={14} className="mr-1 mt-0.5" />
        Back to Attest
      </button>

      <section className="text-center">
        <div className="mx-auto flex h-14 w-14 animate-[scaleIn_300ms_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center rounded-full border border-[var(--solvent-border)] bg-[var(--solvent-bg)]">
          <CheckCircle size={28} className="text-[var(--solvent)]" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">Your Proof is Live</h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">Generated and verified on Midnight Network</p>
      </section>

      <section className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <CategoryIcon size={14} className="text-[var(--accent)]" />
            {categoryLabel} • Midnight Network
          </p>
          <span
            className={`rounded-[4px] border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em] ${overallVerified
              ? 'border-[var(--solvent-border)] bg-[var(--solvent-bg)] text-[var(--solvent)]'
              : 'border-[rgba(220,38,38,0.3)] bg-[var(--insolvent-bg)] text-[var(--insolvent)]'
              }`}
          >
            {overallVerified ? 'Verified' : 'Unverified'}
          </span>
        </div>

        <p className="my-3 text-xl font-bold text-[var(--text-primary)]">{data.protocolName}</p>
        <div className="border-t border-[var(--border)]" />

        <div className="mt-4">
          {attributeRows.map((attribute, index) => (
            <div
              key={`${attribute.label ?? 'attribute'}-${index}`}
              className={`flex items-center justify-between py-2.5 ${index < attributeRows.length - 1 ? 'border-b border-[var(--border)]' : ''
                }`}
            >
              <div className="inline-flex items-center gap-2">
                <span
                  className={`h-[7px] w-[7px] rounded-full ${attribute.enabled
                    ? attribute.pass
                      ? 'bg-[var(--solvent)]'
                      : 'bg-[var(--insolvent)]'
                    : 'bg-[var(--text-muted)] opacity-30'
                    }`}
                />
                <span className={`text-[13px] ${attribute.enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {attribute.label ?? 'Attribute'}
                </span>
              </div>
              <span className={`text-[12px] ${attribute.enabled ? 'font-mono text-[var(--solvent)]' : 'text-[var(--text-muted)]'}`}>
                {attribute.enabled ? '✓ Verified' : '(not included)'}
              </span>
            </div>
          ))}
        </div>

        <div className="my-4 border-t border-[var(--border)]" />
        <div className="flex flex-col gap-1.5">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Clock3 size={11} />
            Issued: {new Date(data.issuedAt).toLocaleDateString()} • Expires: {new Date(data.expiresAt).toLocaleDateString()}
          </p>
          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent)]">
            <Hash size={11} className="text-[var(--text-muted)]" />
            Proof: {shortHash(proofHash)}
          </p>
          {data.txHash && (
            <>
              <a
                href={`https://preprod.midnightexplorer.com/tx/${data.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent)] hover:underline"
              >
                <ExternalLink size={11} className="text-[var(--text-muted)]" />
                View on Midnight Explorer
              </a>
              <p className="text-[11px] text-[var(--text-muted)]">
                Midnight Preprod Explorer may be temporarily unavailable even when the transaction is on-chain.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="mb-4 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Share Your Proof</p>

        <p className="mb-3 text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Share with Specific Audience</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Public */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-all duration-300 hover:border-white/20 hover:bg-[#1a1b1e]">
            <div>
              <div className="flex items-center gap-2 text-[var(--text-secondary)] transition-colors duration-300 group-hover:text-white">
                <Globe size={15} />
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">Public View</p>
              </div>
              <p className="mt-2 text-[11px] leading-[1.6] text-[var(--text-muted)]">
                Displays only the top-level <span className="font-medium text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">VERIFIED</span> status.
              </p>
            </div>
            <button
              onClick={copyPublicLink}
              className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[8px] border px-3 py-2 text-xs font-medium transition-all duration-300 ${copiedPublicLink
                  ? 'border-[var(--solvent-border)] bg-[var(--solvent-bg)] text-[var(--solvent)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] group-hover:border-white/20 group-hover:text-white'
                }`}
            >
              {copiedPublicLink ? <Check size={13} /> : <LinkIcon size={13} />}
              {copiedPublicLink ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          {/* Auditor */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-all duration-300 hover:border-[rgba(108,99,255,0.5)] hover:bg-[rgba(108,99,255,0.03)]">
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--accent)] opacity-0 blur-xl transition-all duration-500 group-hover:opacity-[0.15]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] transition-colors duration-300 group-hover:text-[var(--accent)]">
                <Search size={15} />
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">Auditor View</p>
              </div>
              <p className="mt-2 text-[11px] leading-[1.6] text-[var(--text-muted)]">
                Includes line-item attribute <span className="font-medium text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">pass/fail breakdown</span>.
              </p>
            </div>
            <button
              onClick={copyAuditorLink}
              className={`relative mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[8px] border px-3 py-2 text-xs font-medium transition-all duration-300 ${copiedAuditorLink
                  ? 'border-[var(--solvent-border)] bg-[var(--solvent-bg)] text-[var(--solvent)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] group-hover:border-[var(--accent)] group-hover:bg-[rgba(108,99,255,0.1)] group-hover:text-[var(--accent)]'
                }`}
            >
              {copiedAuditorLink ? <Check size={13} /> : <LinkIcon size={13} />}
              {copiedAuditorLink ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          {/* Regulator */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-all duration-300 hover:border-[rgba(0,211,149,0.5)] hover:bg-[rgba(0,211,149,0.03)]">
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--solvent)] opacity-0 blur-xl transition-all duration-500 group-hover:opacity-[0.12]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] transition-colors duration-300 group-hover:text-[var(--solvent)]">
                <Landmark size={15} />
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">Regulator View</p>
              </div>
              <p className="mt-2 text-[11px] leading-[1.6] text-[var(--text-muted)]">
                Adds compliance <span className="font-medium text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">ratio bands</span> & tx hashes.
              </p>
            </div>
            <button
              onClick={copyRegulatorLink}
              className={`relative mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[8px] border px-3 py-2 text-xs font-medium transition-all duration-300 ${copiedRegulatorLink
                  ? 'border-[var(--solvent-border)] bg-[var(--solvent-bg)] text-[var(--solvent)] hover:shadow-none'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] group-hover:border-[var(--solvent)] group-hover:bg-[rgba(0,211,149,0.1)] group-hover:text-[var(--solvent)]'
                }`}
            >
              {copiedRegulatorLink ? <Check size={13} /> : <LinkIcon size={13} />}
              {copiedRegulatorLink ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>

        <p className="mb-2 mt-4 text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">Share Via</p>
        <div className="flex flex-wrap gap-2 max-sm:flex-col">
          <button
            onClick={shareX}
            className="flex h-10 flex-1 items-center justify-center rounded-lg border border-white/10 bg-black text-[13px] font-medium text-white hover:bg-[#111]"
          >
            𝕏&nbsp; Post to X
          </button>
          <button
            onClick={shareTelegram}
            className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[rgba(0,136,204,0.4)] bg-[rgba(0,136,204,0.15)] text-[13px] font-medium text-[#60B8E0] hover:border-[rgba(0,136,204,0.6)] hover:bg-[rgba(0,136,204,0.25)]"
          >
            ✈ Telegram
          </button>
          <button
            onClick={copyVerifyLink}
            className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium transition-colors ${copiedLink
                ? 'border-[var(--solvent-border)] text-[var(--solvent)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
              }`}
          >
            {copiedLink ? <Check size={14} /> : <LinkIcon size={14} />}
            {copiedLink ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        <p className="mb-2 mt-4 text-[11px] text-[var(--text-muted)]">OR SHARE THE PROOF ID DIRECTLY</p>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
          <p className="flex-1 break-all font-mono text-[11px] text-[var(--text-muted)]">{proofHash}</p>
          <button
            onClick={copyProofHash}
            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs ${copiedHash
              ? 'border-[var(--solvent-border)] text-[var(--solvent)]'
              : 'border-[var(--border)] text-[var(--text-secondary)]'
              }`}
          >
            {copiedHash ? <Check size={12} /> : <Copy size={12} />}
            {copiedHash ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </section>

      <section className="w-full text-center">
        <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <ShieldCheck size={13} />
          Verifiers will only see attribute checkmarks and your verified status.
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Your actual financial figures are never revealed or stored on-chain.</p>
      </section>


      <section className="mt-4 flex w-full gap-4 max-sm:flex-col">
        <button
          onClick={() => navigate(`/verify?hash=${encodeURIComponent(proofHash)}`)}
          className="btn-outline h-12 flex-1 text-[14px]"
        >
          <Eye size={16} className="mr-2" />
          View as Verifier
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn h-12 flex-1 text-[14px]"
        >
          <LayoutDashboard size={16} className="mr-2" />
          Go to Dashboard
        </button>
      </section>
    </main>
  );
}
