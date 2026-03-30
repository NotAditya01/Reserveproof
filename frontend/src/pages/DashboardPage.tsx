import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock3, Shield, TrendingUp } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { useWallet } from '../context/WalletContext';
import type { SolvencyStatus } from '../lib/reserve';
import { ratioBandFromStatus, statusDotClass } from '../lib/reserve';
import SolvencyBadge from '../components/SolvencyBadge';

type HistoryRow = {
  protocolName: string;
  solvencyStatus: SolvencyStatus;
  proofHash: string;
  createdAt: string;
};

type Range = '7D' | '30D' | 'All';

function toRatio(status: SolvencyStatus): number {
  if (status === 'SOLVENT') return 126;
  if (status === 'WARNING') return 110;
  return 94;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function initials(address: string): string {
  return address.slice(0, 4).toUpperCase();
}

export default function DashboardPage() {
  const { walletAddress, disconnectWallet } = useWallet();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('30D');
  const [shareState, setShareState] = useState<{
    hash: string;
    status: 'copied' | 'failed';
  } | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(API_ENDPOINTS.RESERVE.HISTORY(walletAddress))
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load history');
        return res.json();
      })
      .then((data) => setRows(data.history ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load history'));
  }, [walletAddress]);

  async function share(hash: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/verify?hash=${hash}`);
      setShareState({ hash, status: 'copied' });
    } catch {
      setShareState({ hash, status: 'failed' });
    } finally {
      window.setTimeout(() => {
        setShareState((current) => (current?.hash === hash ? null : current));
      }, 1800);
    }
  }

  const filteredRows = useMemo(() => {
    const now = Date.now();
    if (range === 'All') return rows;
    const days = range === '7D' ? 7 : 30;
    return rows.filter((row) => now - new Date(row.createdAt).getTime() <= days * 24 * 60 * 60 * 1000);
  }, [rows, range]);

  const realChartData = filteredRows
    .slice()
    .reverse()
    .map((row) => ({
      date: new Date(row.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ratio: toRatio(row.solvencyStatus),
    }));

  const chartData = useMemo(() => {
    if (realChartData.length > 1) return realChartData;
    if (realChartData.length === 1) {
      const now = new Date();
      const mockPoints = [138, 142, 135, 141].map((ratio, idx) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (4 - idx) * 7);
        return {
          date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          ratio,
        };
      });
      return [...mockPoints, realChartData[0]];
    }
    return [];
  }, [realChartData]);

  const latest = rows[0];
  const latestDate = latest ? new Date(latest.createdAt).toLocaleDateString() : '—';

  return (
    <main className="page-shell mx-auto max-w-[1200px] px-6 pb-12 pt-[84px]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">My Attestations</h1>
          {walletAddress && (
            <div className="mt-2 inline-flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--accent-dim)] text-[10px] font-bold text-[var(--accent)]">
                {initials(walletAddress)}
              </span>
              <span className="font-mono text-xs text-[var(--text-secondary)]">{shortAddress(walletAddress)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/attest" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            + New Attestation
          </Link>
          <button onClick={disconnectWallet} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            Disconnect
          </button>
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-[var(--insolvent)]">{error}</p>}

      <section className="mb-4 grid gap-2 md:grid-cols-3">
        <article className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Total Proofs</p>
          <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{rows.length}</p>
        </article>
        <article className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Latest Status</p>
          <div className="mt-1">
            {latest ? (
              <p
                className={`text-[20px] font-bold ${
                  latest.solvencyStatus === 'SOLVENT'
                    ? 'text-[var(--solvent)]'
                    : latest.solvencyStatus === 'WARNING'
                      ? 'text-[var(--warning)]'
                      : 'text-[var(--insolvent)]'
                }`}
              >
                {latest.solvencyStatus}
              </p>
            ) : (
              <p className="text-lg font-bold text-[var(--text-primary)]">—</p>
            )}
          </div>
        </article>
        <article className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Last Attested</p>
          <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{latestDate}</p>
        </article>
      </section>

      <section className="surface-card mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Solvency Trend</h2>
          <div className="inline-flex gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-1">
            {(['7D', '30D', 'All'] as Range[]).map((item) => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  range === item
                    ? 'border border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                    : 'border border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[180px]">
          {chartData.length === 0 ? (
            <div className="grid h-full place-items-center">
              <div className="text-center">
                <TrendingUp size={28} className="mx-auto text-[var(--text-muted)] opacity-40" />
                <p className="mt-3 text-sm font-semibold text-[var(--text-muted)]">No trend data yet</p>
                <p className="mx-auto mt-1.5 max-w-[260px] text-xs text-[var(--text-muted)] opacity-60">
                  Your solvency ratio history will appear here after multiple attestations
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fontSize: 11 }}
                  domain={[80, 140]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-primary)',
                  }}
                />
                <ReferenceLine y={100} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Warning', fill: 'var(--text-muted)', fontSize: 11, position: 'insideBottomRight' }} />
                <ReferenceLine y={120} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Healthy', fill: 'var(--text-muted)', fontSize: 11, position: 'insideTopRight' }} />
                <Area type="monotone" dataKey="ratio" stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.1} dot={{ r: 4, fill: 'var(--accent)' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        {realChartData.length <= 1 && realChartData.length > 0 && (
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">(Demo data)</p>
        )}
      </section>

      {rows.length === 0 ? (
        <div className="grid place-items-center py-16 text-center">
          <Shield size={32} className="text-[var(--text-muted)]" />
          <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">No attestations yet</h3>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Generate your first ZK proof of solvency</p>
          <Link to="/attest" className="mt-5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Generate First Proof
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <article
              key={row.proofHash}
              className="grid gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--border-hover)] md:grid-cols-[1.2fr_1fr_1.3fr] md:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${statusDotClass(row.solvencyStatus)}`} />
                  <p className="text-[15px] font-semibold text-[var(--text-primary)]">{row.protocolName}</p>
                </div>
                <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{new Date(row.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <SolvencyBadge status={row.solvencyStatus} />
                <p className="mt-1 text-xs text-[var(--text-muted)]">Ratio: {ratioBandFromStatus(row.solvencyStatus)}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <Clock3 size={11} />
                  Expires: {new Date(new Date(row.createdAt).getTime() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>
              <div className="md:justify-self-end">
                <p className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Proof ID</p>
                <p className="font-mono text-xs text-[var(--accent)]">{row.proofHash.slice(0, 10)}...{row.proofHash.slice(-8)}</p>
                <div className="mt-2 flex gap-2 md:justify-end">
                  <button
                    onClick={() => share(row.proofHash)}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                  >
                    Share
                  </button>
                  <Link
                    to={`/verify?hash=${row.proofHash}`}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                  >
                    View
                  </Link>
                </div>
                {shareState?.hash === row.proofHash && (
                  <p
                    className={`mt-1 text-[11px] md:text-right ${
                      shareState.status === 'copied'
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--insolvent)]'
                    }`}
                  >
                    {shareState.status === 'copied' ? 'Link copied' : 'Copy failed'}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
