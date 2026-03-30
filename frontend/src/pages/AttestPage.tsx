import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';
import { useWallet } from '../context/WalletContext';
import {
  CATEGORY_TEMPLATES,
  type AttributeState,
  defaultAttributeStates,
  evaluateAttributeState,
  type CategoryType,
} from '../lib/proofTemplates';

const STEP_LABELS = [
  'Financial data committed locally',
  'ZK circuit computed',
  'Proof submitted to Midnight Network',
  'On-chain verification complete',
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function inputValueForApi(value: string): number | string {
  if (/^\d[\d,]*$/.test(value.trim())) {
    return toNumber(value);
  }
  return value.trim();
}

export default function AttestPage() {
  const navigate = useNavigate();
  const { walletAddress, connectWallet, loading: walletLoading, error: walletError } = useWallet();

  const [categoryType, setCategoryType] = useState<CategoryType | null>(null);
  const [protocolName, setProtocolName] = useState('Reserve Protocol');
  const [attributeStates, setAttributeStates] = useState<AttributeState[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [proofHash, setProofHash] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => CATEGORY_TEMPLATES.find((category) => category.type === categoryType) ?? null,
    [categoryType],
  );

  const reserveRatio = useMemo(() => {
    const reserveState = attributeStates.find((item) => item.type === 'reserve_ratio');
    if (!reserveState) return 0;
    const reserves = toNumber(reserveState.inputs.reserves ?? '');
    const liabilities = Math.max(1, toNumber(reserveState.inputs.liabilities ?? ''));
    return Number(((reserves / liabilities) * 100).toFixed(2));
  }, [attributeStates]);

  const previewRows = useMemo(() => {
    if (!selectedCategory) return [];
    return selectedCategory.attributes.map((attribute) => {
      const state = attributeStates.find((item) => item.type === attribute.type);
      if (!state) {
        return {
          label: attribute.label,
          enabled: false,
          pass: false,
          output: '(off)',
          required: attribute.required,
        };
      }
      const evaluated = evaluateAttributeState(attribute, state, reserveRatio);
      return {
        label: attribute.label,
        enabled: state.required ? true : state.enabled,
        pass: evaluated.pass,
        output: evaluated.output,
        required: state.required,
      };
    });
  }, [selectedCategory, attributeStates, reserveRatio]);

  const overallVerified = useMemo(() => {
    if (!previewRows.length) return false;
    return previewRows.filter((row) => row.required).every((row) => row.pass);
  }, [previewRows]);

  function onCategorySelect(nextCategory: CategoryType) {
    const category = CATEGORY_TEMPLATES.find((item) => item.type === nextCategory);
    if (!category) return;
    setCategoryType(nextCategory);
    setAttributeStates(defaultAttributeStates(category));
    setProtocolName(category.label);
  }

  function updateToggle(type: string) {
    setAttributeStates((prev) =>
      prev.map((item) => {
        if (item.type !== type || item.required) return item;
        return { ...item, enabled: !item.enabled };
      }),
    );
  }

  function updateInput(type: string, key: string, value: string) {
    setAttributeStates((prev) =>
      prev.map((item) => {
        if (item.type !== type) return item;
        return {
          ...item,
          inputs: {
            ...item.inputs,
            [key]: value,
          },
        };
      }),
    );
  }

  async function handleAttest() {
    try {
      setLoading(true);
      setError(null);
      setActiveStep(0);

      let activeWallet = walletAddress;
      if (!activeWallet) {
        activeWallet = await connectWallet();
      }
      if (!activeWallet) {
        throw new Error('Wallet connection required');
      }

      const reserveState = attributeStates.find((item) => item.type === 'reserve_ratio');
      const totalReserves = reserveState ? toNumber(reserveState.inputs.reserves ?? '') : 1200000;
      const totalLiabilities = reserveState ? Math.max(1, toNumber(reserveState.inputs.liabilities ?? '')) : 850000;

      const attributesPayload = attributeStates.map((attribute) => ({
        type: attribute.type,
        enabled: attribute.required ? true : attribute.enabled,
        inputs: Object.fromEntries(
          Object.entries(attribute.inputs).map(([key, value]) => [key, inputValueForApi(value)]),
        ),
      }));

      const request = fetch(API_ENDPOINTS.RESERVE.ATTEST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: activeWallet,
          protocolName: protocolName.trim(),
          categoryType,
          attributes: attributesPayload,
          totalReserves,
          totalLiabilities,
        }),
      });

      for (let i = 1; i < STEP_LABELS.length; i += 1) {
        await sleep(760);
        setActiveStep(i);
      }

      const response = await request;
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Failed to generate attestation');
      }

      const payload = await response.json();
      setProofHash(payload.proofHash);
      await sleep(360);
      navigate(`/attest/${encodeURIComponent(payload.proofHash)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to attest reserves');
    } finally {
      setLoading(false);
      setTimeout(() => setActiveStep(-1), 160);
    }
  }

  return (
    <main className="page-shell mx-auto flex max-w-[1200px] items-center px-6 pb-12 pt-[84px]">
      <div className="w-full grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
        <section className="surface-card p-7">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">What Are You?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_TEMPLATES.map((category) => (
              <button
                key={category.type}
                onClick={() => onCategorySelect(category.type)}
                className={`rounded-[10px] border p-4 text-left ${
                  categoryType === category.type
                    ? 'border-[var(--accent)] bg-[var(--accent-dim)]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                <category.icon size={18} className="text-[var(--text-secondary)]" />
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{category.label}</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{category.sublabel}</p>
              </button>
            ))}
          </div>

          {!selectedCategory ? (
            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">Select your project type to continue</p>
          ) : (
            <div className="route-fade mt-6">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Attest Your Reserves</h1>
              <label className="mt-4 block">
                <span className="mb-2 block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Protocol / Project Name</span>
                <input
                  value={protocolName}
                  onChange={(e) => setProtocolName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </label>

              <div className="mt-5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Select What to Prove</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Toggle off anything you don&apos;t want included in your proof</p>
              </div>

              <div className="mt-3">
                {selectedCategory.attributes.map((attribute) => {
                  const state = attributeStates.find((item) => item.type === attribute.type);
                  if (!state) return null;
                  const enabled = state.required ? true : state.enabled;
                  return (
                    <article
                      key={attribute.type}
                      className={`mb-2 rounded-[10px] border p-4 transition ${
                        enabled ? 'border-[var(--border)] bg-[var(--surface)] opacity-100' : 'border-[var(--border)] bg-[var(--surface)] opacity-40'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <button
                              onClick={() => updateToggle(attribute.type)}
                              disabled={state.required}
                              className={`relative h-5 w-9 rounded-full ${
                                enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'
                              } ${state.required ? 'cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                                  enabled ? 'left-[18px]' : 'left-0.5'
                                }`}
                              />
                            </button>
                            <p className="ml-2.5 text-sm font-semibold text-[var(--text-primary)]">{attribute.label}</p>
                            {state.required && (
                              <span className="ml-2 rounded-[4px] border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-[var(--insolvent)]">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="ml-[46px] mt-2 text-xs leading-5 text-[var(--text-muted)]">{attribute.description}</p>
                        </div>

                        {enabled && attribute.inputs.length > 0 && (
                          <div className="route-fade w-full space-y-2 sm:w-[220px]">
                            {attribute.inputs.map((input) => (
                              <label key={input.key} className="block">
                                <span className="mb-1 block text-[10px] text-[var(--text-muted)]">{input.label}</span>
                                <input
                                  value={state.inputs[input.key] ?? ''}
                                  onChange={(e) => updateInput(attribute.type, input.key, e.target.value)}
                                  placeholder={input.placeholder}
                                  type={input.type === 'text' ? 'text' : 'text'}
                                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <button
                onClick={handleAttest}
                disabled={loading || walletLoading}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? 'Generating proof...' : 'Generate ZK Proof'}
              </button>
            </div>
          )}

          {walletError && <p className="mt-3 text-sm text-[var(--insolvent)]">{walletError}</p>}
          {error && <p className="mt-3 text-sm text-[var(--insolvent)]">{error}</p>}
        </section>

        <div className="hidden h-full min-h-[480px] w-px bg-[var(--border)] lg:block" />

        <section className="surface-card p-7">
          <div className="flex items-center justify-between">
            <p className="section-label">Proof Preview</p>
            <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--solvent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--solvent)]" />
              Live
            </p>
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {selectedCategory ? `${selectedCategory.label} • Midnight Network` : 'Select category to configure proof template'}
          </p>

          <div className="mt-5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] p-5">
            {previewRows.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No attributes selected yet.</p>
            ) : (
              <div className="space-y-2">
                {previewRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <div className="inline-flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${row.enabled ? (row.pass ? 'bg-[var(--solvent)]' : 'bg-[var(--insolvent)]') : 'bg-[var(--text-muted)]'}`} />
                      <span className="text-[var(--text-primary)]">{row.label}</span>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">{row.output}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-[var(--border)] pt-3">
              <p className={`text-sm font-semibold ${overallVerified ? 'text-[var(--solvent)]' : 'text-[var(--warning)]'}`}>
                Overall: {overallVerified ? 'VERIFIED' : 'INCOMPLETE'}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-[var(--accent)]">
                Proof hash: {proofHash ? `${proofHash.slice(0, 12)}...${proofHash.slice(-8)}` : 'Pending...'}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Issued: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </section>
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <div className="surface-card w-full max-w-md p-5">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Generating Reserve Attestation</h2>
            <div className="mt-4 space-y-3">
              {STEP_LABELS.map((label, idx) => (
                <div key={label} className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      idx <= activeStep
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className={idx <= activeStep ? 'text-sm text-[var(--text-primary)]' : 'text-sm text-[var(--text-muted)]'}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
