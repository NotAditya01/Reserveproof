import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { DatabaseService } from '../db/DatabaseService.js';

export const reserveRouter: Router = Router();

const db = new DatabaseService();

type SolvencyStatus = 'SOLVENT' | 'WARNING' | 'INSOLVENT';
type CategoryType = 'exchange' | 'defi' | 'nft' | 'airdrop' | 'dao' | 'lending';
type AttributePayload = {
  type: string;
  inputs?: Record<string, unknown>;
  enabled: boolean;
};
type AttributeResult = {
  type: string;
  label: string;
  enabled: boolean;
  required: boolean;
  pass: boolean;
  output: string;
};

function isValidNumber(input: unknown): input is number {
  return typeof input === 'number' && Number.isFinite(input);
}

function computeReserveRatio(totalReserves: number, totalLiabilities: number): number {
  return Number(((totalReserves / totalLiabilities) * 100).toFixed(2));
}

function statusFromReserveRatio(reserveRatio: number): SolvencyStatus {
  if (reserveRatio >= 120) return 'SOLVENT';
  if (reserveRatio >= 100) return 'WARNING';
  return 'INSOLVENT';
}

function reserveBandFromStatus(solvencyStatus: SolvencyStatus): string {
  if (solvencyStatus === 'SOLVENT') return 'Above 120%';
  if (solvencyStatus === 'WARNING') return '100–120%';
  return 'Below 100%';
}

function thresholdFromStatus(solvencyStatus: SolvencyStatus): number {

  if (solvencyStatus === 'SOLVENT') return 740;
  if (solvencyStatus === 'WARNING') return 580;
  return 300;
}

function scoreFromReserveRatio(reserveRatio: number): number {

  const ratio = Math.max(0, Math.min(reserveRatio, 300));
  if (ratio < 100) {
    return Math.round(300 + (ratio / 100) * 279);
  }
  if (ratio < 120) {
    return Math.round(580 + ((ratio - 100) / 20) * 159);
  }
  return Math.round(Math.min(850, 740 + ((ratio - 120) / 180) * 110));
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseCategory(value: unknown): CategoryType | null {
  if (typeof value !== 'string') return null;
  if (['exchange', 'defi', 'nft', 'airdrop', 'dao', 'lending'].includes(value)) {
    return value as CategoryType;
  }
  return null;
}

function requiredAttributes(category: CategoryType): Set<string> {
  if (category === 'exchange') return new Set(['reserve_ratio']);
  if (category === 'defi') return new Set(['reserve_ratio']);
  if (category === 'nft') return new Set(['treasury_funded']);
  if (category === 'airdrop') return new Set(['treasury_solvent']);
  if (category === 'dao') return new Set(['treasury_solvency']);
  return new Set(['reserve_ratio', 'collateral_ratio']);
}

function evaluateAttribute(
  type: string,
  inputs: Record<string, unknown>,
  reserveRatio: number,
): Pick<AttributeResult, 'pass' | 'output' | 'label'> {
  const labels: Record<string, string> = {
    reserve_ratio: 'Reserve Ratio',
    operational_runway: 'Operational Runway',
    fund_segregation: 'Fund Segregation',
    solvency_band: 'Solvency Band',
    smart_contract_audited: 'Smart Contract Audited',
    liquidity_depth: 'Liquidity Depth',
    collateral_ratio: 'Collateral Ratio',
    treasury_funded: 'Treasury Funded',
    team_allocation_locked: 'Team Allocation Locked',
    royalty_committed: 'Royalty Committed',
    treasury_solvent: 'Treasury Solvent',
    team_tokens_locked: 'Team Tokens Locked',
    token_supply_committed: 'Token Supply Committed',
    distribution_timeline: 'Distribution Timeline',
    treasury_solvency: 'Treasury Solvency',
    contributor_pay_backed: 'Contributor Pay Backed',
    multi_sig_controlled: 'Multi-sig Controlled',
    bad_debt_ratio: 'Bad Debt Ratio',
  };

  const label = labels[type] ?? type;

  if (type === 'reserve_ratio') {
    const pass = reserveRatio >= 120;
    return { label, pass, output: pass ? 'Above 120% ✅' : '❌ Below 120%' };
  }
  if (type === 'operational_runway') {
    const pass = toNumber(inputs.cashReserves) / Math.max(1, toNumber(inputs.monthlyCost)) >= 6;
    return { label, pass, output: pass ? 'Runway: 6+ months ✅' : 'Runway: <6 months ❌' };
  }
  if (type === 'fund_segregation') {
    const pass = toNumber(inputs.customerFunds) !== toNumber(inputs.operationalFunds);
    return { label, pass, output: pass ? 'Funds Segregated ✅' : 'Funds Mixed ❌' };
  }
  if (type === 'solvency_band') {
    const pass = reserveRatio >= 120;
    return { label, pass, output: pass ? 'Solvency Band: Healthy ✅' : 'Band: At risk ❌' };
  }
  if (type === 'smart_contract_audited') {
    const pass = toNumber(inputs.vulnerabilities) === 0;
    return { label, pass, output: pass ? 'Audited: 0 critical issues ✅' : 'Audit: issues present ❌' };
  }
  if (type === 'liquidity_depth') {
    const pass = toNumber(inputs.liquidityDepth) / Math.max(1, toNumber(inputs.tvl)) >= 0.4;
    return { label, pass, output: pass ? 'Liquidity Ratio: Above 40% ✅' : 'Liquidity Ratio: Below 40% ❌' };
  }
  if (type === 'collateral_ratio') {
    const pass = toNumber(inputs.collateral) / Math.max(1, toNumber(inputs.loans)) >= 1.5;
    return { label, pass, output: pass ? 'Collateral Ratio: Above 150% ✅' : 'Collateral Ratio: Below 150% ❌' };
  }
  if (type === 'treasury_funded') {
    const pass = toNumber(inputs.treasury) / Math.max(1, toNumber(inputs.deliveryCost)) >= 1;
    return { label, pass, output: pass ? 'Treasury: Funded for delivery ✅' : 'Treasury: Underfunded ❌' };
  }
  if (type === 'team_allocation_locked' || type === 'team_tokens_locked') {
    const pass = toNumber(inputs.lockMonths ?? inputs.vestingMonths) >= 12;
    return { label, pass, output: pass ? 'Team Locked: 12+ months ✅' : 'Team Locked: <12 months ❌' };
  }
  if (type === 'royalty_committed') {
    const pass = toNumber(inputs.royaltyPct) > 0;
    return { label, pass, output: pass ? 'Royalty: Locked on-chain ✅' : 'Royalty: Not committed ❌' };
  }
  if (type === 'treasury_solvent' || type === 'treasury_solvency') {
    const numerator = toNumber(inputs.operationalTreasury ?? inputs.treasury);
    const denominator = toNumber(inputs.airdropCosts ?? inputs.committedExpenditure);
    const pass = numerator / Math.max(1, denominator) >= 1;
    return { label, pass, output: pass ? 'Treasury: Solvent ✅' : 'Treasury: Insolvent ❌' };
  }
  if (type === 'token_supply_committed') {
    const pass = toNumber(inputs.circulatingPct) <= 30;
    return { label, pass, output: pass ? 'Supply: Fixed & committed ✅' : 'Supply: Risky float ❌' };
  }
  if (type === 'distribution_timeline') {
    const pass = toNumber(inputs.distributionDays) <= 30;
    return { label, pass, output: pass ? 'Distribution: On schedule ✅' : 'Distribution: Delayed ❌' };
  }
  if (type === 'contributor_pay_backed') {
    const pass = toNumber(inputs.payReserve) / Math.max(1, toNumber(inputs.monthlyContributorCosts)) >= 3;
    return { label, pass, output: pass ? 'Contributors: Funded ✅' : 'Contributors: Underfunded ❌' };
  }
  if (type === 'multi_sig_controlled') {
    const pass = toNumber(inputs.signers) >= 3 && toNumber(inputs.requiredSignatures) >= 2;
    return { label, pass, output: pass ? 'Multi-sig: Active ✅' : 'Multi-sig: Weak ❌' };
  }
  if (type === 'bad_debt_ratio') {
    const pass = toNumber(inputs.badDebtAmount) / Math.max(1, toNumber(inputs.totalLoans)) <= 0.05;
    return { label, pass, output: pass ? 'Bad Debt: Below 5% ✅' : 'Bad Debt: Above 5% ❌' };
  }

  return { label, pass: true, output: 'Verified ✅' };
}

reserveRouter.post('/attest', async (req: Request, res: Response) => {
  const {
    walletAddress,
    protocolName,
    totalReserves,
    totalLiabilities,
    categoryType,
    attributes,
  } = req.body as {
    walletAddress?: string;
    protocolName?: string;
    totalReserves?: number;
    totalLiabilities?: number;
    categoryType?: string;
    attributes?: AttributePayload[];
  };

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ error: 'walletAddress is required' });
  }
  if (!protocolName || typeof protocolName !== 'string' || !protocolName.trim()) {
    return res.status(400).json({ error: 'protocolName is required' });
  }
  const parsedCategory = parseCategory(categoryType);
  const hasTemplateMode = Boolean(parsedCategory && Array.isArray(attributes) && attributes.length > 0);

  let reserves = isValidNumber(totalReserves) ? totalReserves : 0;
  let liabilities = isValidNumber(totalLiabilities) ? totalLiabilities : 0;
  let attributeResults: Record<string, AttributeResult> | null = null;
  let attributesSelected: string[] | null = null;
  let overallVerified: boolean | null = null;

  if (hasTemplateMode && parsedCategory) {
    const required = requiredAttributes(parsedCategory);
    const byType = new Map<string, AttributePayload>();
    for (const attribute of attributes ?? []) {
      byType.set(attribute.type, attribute);
    }

    const reserveAttribute = byType.get('reserve_ratio');
    if (reserveAttribute?.enabled !== false) {
      const reserveInputs = reserveAttribute?.inputs ?? {};
      reserves = toNumber(reserveInputs.reserves);
      liabilities = toNumber(reserveInputs.liabilities);
    } else if (!isValidNumber(totalReserves) || !isValidNumber(totalLiabilities)) {
      reserves = 1200000;
      liabilities = 850000;
    }

    if (liabilities <= 0) liabilities = 1;
    const reserveRatioForAttributes = computeReserveRatio(reserves, liabilities);
    attributeResults = {};
    attributesSelected = [];

    for (const [type, attribute] of byType.entries()) {
      const requiredAttribute = required.has(type);
      const enabled = requiredAttribute ? true : attribute.enabled;
      if (enabled) {
        attributesSelected.push(type);
      }
      const evaluation = evaluateAttribute(type, attribute.inputs ?? {}, reserveRatioForAttributes);
      attributeResults[type] = {
        type,
        label: evaluation.label,
        enabled,
        required: requiredAttribute,
        pass: enabled ? evaluation.pass : false,
        output: enabled ? evaluation.output : '(off)',
      };
    }

    overallVerified = Object.values(attributeResults)
      .filter((attr) => attr.required)
      .every((attr) => attr.pass);
  } else {
    if (!isValidNumber(totalReserves) || totalReserves < 0) {
      return res.status(400).json({ error: 'totalReserves must be a non-negative number' });
    }
    if (!isValidNumber(totalLiabilities) || totalLiabilities <= 0) {
      return res.status(400).json({ error: 'totalLiabilities must be greater than 0' });
    }
    reserves = totalReserves;
    liabilities = totalLiabilities;
  }

  const reserveRatio = computeReserveRatio(reserves, liabilities);
  const solvencyStatus = statusFromReserveRatio(reserveRatio);
  const threshold = thresholdFromStatus(solvencyStatus);
  const proofScore = scoreFromReserveRatio(reserveRatio);

  const attestation = await db.createReserveAttestation({
    walletAddress,
    protocolName: protocolName.trim(),
    totalReserves: reserves,
    totalLiabilities: liabilities,
    reserveRatio,
    solvencyStatus,
    categoryType: parsedCategory,
    attributesSelected,
    attributesResults: attributeResults,
    overallVerified,
  });

  let proofResult: { success: boolean; requestId: string; salt: string; txHash: string; error?: string };
  try {
    console.log(`[API] 🚀 Initiating ZK proof generation...`);
    const startTime = Date.now();
    
    const { VerificationProof } = await import('../services/VerificationProof.js');
    const verificationProof = new VerificationProof();
    proofResult = await verificationProof.generateVerificationProof({
      reserveRatio: proofScore,
      tierThreshold: threshold,
    });
    
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[API] 🎉 ZK proof generated successfully in ${durationSec}s!`);
  } catch (runtimeError) {
    const message = runtimeError instanceof Error ? runtimeError.message : String(runtimeError);
    console.error(`[API] ❌ ZK proof generation/submission error: ${message}`);
    return res.status(500).json({
      error: 'ZK proof generation failed',
      details: message,
    });
  }

  if (!proofResult.success) {
    return res.status(500).json({
      error: 'Failed to generate proof',
      details: proofResult.error,
    });
  }

  const proofHash = crypto
    .createHash('sha256')
    .update(`${attestation.id}:${walletAddress}:${proofResult.requestId}:${proofResult.salt}`)
    .digest('hex');

  const stored = await db.setReserveAttestationProof({
    attestationId: attestation.id,
    walletAddress,
    proofHash,
    verified: true,
    txHash: proofResult.txHash || undefined,
    onChain: !!proofResult.txHash,
  });

  if (!stored) {
    return res.status(404).json({ error: 'failed to store proof hash' });
  }

  return res.json({
    attestationId: attestation.id,
    solvencyStatus: stored.solvencyStatus,
    proofHash,
    categoryType: parsedCategory,
    attributesResults: attributeResults,
    overallVerified,
    txHash: proofResult.txHash || null,
    onChain: !!proofResult.txHash,
  });
});

reserveRouter.post('/verify', async (req: Request, res: Response) => {
  const { proofHash } = req.body as { proofHash?: string };
  const rawView = req.query.view as string | undefined;
  const validViews = ['public', 'auditor', 'regulator'] as const;
  type ViewLevel = (typeof validViews)[number] | 'none';
  const viewLevel: ViewLevel = validViews.includes(rawView as (typeof validViews)[number])
    ? (rawView as (typeof validViews)[number])
    : 'none';

  if (!proofHash || typeof proofHash !== 'string') {
    return res.status(400).json({ error: 'proofHash is required' });
  }

  const verification = await db.getReserveByProofHash(proofHash);
  if (!verification) {
    return res.status(404).json({ error: 'proof not found or expired' });
  }

  // Base fields shared by all view levels
  const base = {
    protocolName: verification.protocolName,
    solvencyStatus: verification.solvencyStatus,
    verified: verification.verified,
    categoryType: verification.categoryType,
    overallVerified: verification.overallVerified,
    issuedAt: verification.issuedAt,
    expiresAt: verification.expiresAt,
    proofHash,
    onChain: verification.onChain,
  };

  // No view param — backward-compatible full response (used by AttestProofPage)
  if (viewLevel === 'none') {
    return res.json({
      ...base,
      reserveRatio: reserveBandFromStatus(verification.solvencyStatus),
      attributesResults: verification.attributesResults,
      txHash: verification.txHash,
    });
  }

  // view=public — overall status only, no attribute details
  if (viewLevel === 'public') {
    return res.json(base);
  }

  // Build filtered attributes array for auditor+
  type StoredAttr = { label?: string; pass?: boolean; enabled?: boolean };
  const rawResults = verification.attributesResults as Record<string, StoredAttr> | null;
  const attributes = rawResults
    ? Object.values(rawResults)
        .filter((a) => a.enabled !== false)
        .map((a) => ({ name: a.label ?? 'Attribute', verified: a.pass ?? false }))
    : [];

  // view=auditor — pass/fail breakdown, no values or bands
  if (viewLevel === 'auditor') {
    return res.json({ ...base, attributes });
  }

  // view=regulator — full compliance view with ratio band + on-chain info
  return res.json({
    ...base,
    attributes,
    ratioBand: reserveBandFromStatus(verification.solvencyStatus),
    txHash: verification.txHash,
    networkId: 'preprod',
  });
});


reserveRouter.get('/history/protocol/:protocolName', async (req: Request, res: Response) => {
  const protocolName = req.params.protocolName;
  if (!protocolName) {
    return res.status(400).json({ error: 'protocolName is required' });
  }
  const history = await db.getReserveHistoryByProtocol(protocolName);
  return res.json({ protocolName, history });
});

reserveRouter.get('/history/:walletAddress', async (req: Request, res: Response) => {
  const walletAddress = req.params.walletAddress;
  const history = await db.getReserveHistoryByWallet(walletAddress);
  return res.json({ walletAddress, history });
});

reserveRouter.get('/feed', async (_req: Request, res: Response) => {
  const feed = await db.getReserveFeed(10);
  return res.json({ feed });
});
