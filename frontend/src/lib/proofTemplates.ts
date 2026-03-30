import type { LucideIcon } from 'lucide-react';
import { BarChart3, Building2, Image, Rocket, Users, Zap } from 'lucide-react';

export type CategoryType = 'exchange' | 'defi' | 'nft' | 'airdrop' | 'dao' | 'lending';

export type AttributeInputDef = {
  key: string;
  label: string;
  placeholder: string;
  type?: 'number' | 'text';
};

export type AttributeTemplate = {
  type: string;
  label: string;
  description: string;
  required: boolean;
  defaultEnabled: boolean;
  inputs: AttributeInputDef[];
  outputPass: string;
  outputFail: string;
};

export type CategoryTemplate = {
  type: CategoryType;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  attributes: AttributeTemplate[];
};

export type AttributeState = {
  type: string;
  enabled: boolean;
  required: boolean;
  inputs: Record<string, string>;
};

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    type: 'exchange',
    label: 'Crypto Exchange',
    sublabel: 'Prove reserves & solvency',
    icon: Building2,
    attributes: [
      {
        type: 'reserve_ratio',
        label: 'Reserve Ratio',
        description: 'Prove your reserves exceed total customer liabilities',
        required: true,
        defaultEnabled: true,
        inputs: [
          { key: 'reserves', label: 'TOTAL RESERVES (USD)', placeholder: '1200000' },
          { key: 'liabilities', label: 'TOTAL LIABILITIES (USD)', placeholder: '850000' },
        ],
        outputPass: 'Above 120% ✅',
        outputFail: '❌ Below 120%',
      },
      {
        type: 'operational_runway',
        label: 'Operational Runway',
        description: 'Prove you can operate for 6+ months without new revenue',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'monthlyCost', label: 'MONTHLY OPERATING COSTS (USD)', placeholder: '100000' },
          { key: 'cashReserves', label: 'CURRENT CASH RESERVES (USD)', placeholder: '700000' },
        ],
        outputPass: 'Runway: 6+ months ✅',
        outputFail: 'Runway: <6 months ❌',
      },
      {
        type: 'fund_segregation',
        label: 'Fund Segregation',
        description: 'Prove customer funds are separate from operational funds',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'customerFunds', label: 'CUSTOMER FUNDS (USD)', placeholder: '900000' },
          { key: 'operationalFunds', label: 'OPERATIONAL FUNDS (USD)', placeholder: '300000' },
        ],
        outputPass: 'Funds Segregated ✅',
        outputFail: 'Funds Mixed ❌',
      },
      {
        type: 'solvency_band',
        label: 'Solvency Band',
        description: 'Prove reserve ratio falls within a healthy band',
        required: false,
        defaultEnabled: true,
        inputs: [],
        outputPass: 'Solvency Band: Healthy ✅',
        outputFail: 'Band: At risk ❌',
      },
    ],
  },
  {
    type: 'defi',
    label: 'DeFi Protocol',
    sublabel: 'Prove TVL & collateral',
    icon: Zap,
    attributes: [
      {
        type: 'reserve_ratio',
        label: 'Reserve Ratio',
        description: 'Prove your reserves exceed total customer liabilities',
        required: true,
        defaultEnabled: true,
        inputs: [
          { key: 'reserves', label: 'TOTAL RESERVES (USD)', placeholder: '1200000' },
          { key: 'liabilities', label: 'TOTAL LIABILITIES (USD)', placeholder: '850000' },
        ],
        outputPass: 'Above 120% ✅',
        outputFail: '❌ Below 120%',
      },
      {
        type: 'smart_contract_audited',
        label: 'Smart Contract Audited',
        description: 'Prove an independent audit was completed without naming the auditor',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'auditDate', label: 'AUDIT DATE (month/year)', placeholder: '03/2026', type: 'text' },
          { key: 'vulnerabilities', label: 'VULNERABILITIES FOUND', placeholder: '0' },
        ],
        outputPass: 'Audited: 0 critical issues ✅',
        outputFail: 'Audit: issues present ❌',
      },
      {
        type: 'liquidity_depth',
        label: 'Liquidity Depth',
        description: 'Prove sufficient liquidity exists relative to TVL',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'tvl', label: 'TOTAL VALUE LOCKED (USD)', placeholder: '3000000' },
          { key: 'liquidityDepth', label: 'LIQUIDITY POOL DEPTH (USD)', placeholder: '1400000' },
        ],
        outputPass: 'Liquidity Ratio: Above 40% ✅',
        outputFail: 'Liquidity Ratio: Below 40% ❌',
      },
      {
        type: 'collateral_ratio',
        label: 'Collateral Ratio',
        description: 'Prove loans are backed by sufficient collateral',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'loans', label: 'TOTAL LOANS ISSUED (USD)', placeholder: '1200000' },
          { key: 'collateral', label: 'TOTAL COLLATERAL (USD)', placeholder: '2000000' },
        ],
        outputPass: 'Collateral Ratio: Above 150% ✅',
        outputFail: 'Collateral Ratio: Below 150% ❌',
      },
    ],
  },
  {
    type: 'nft',
    label: 'NFT Launch',
    sublabel: 'Prove treasury & lockup',
    icon: Image,
    attributes: [
      {
        type: 'treasury_funded',
        label: 'Treasury Funded',
        description: 'Prove sufficient funds exist to deliver your project roadmap',
        required: true,
        defaultEnabled: true,
        inputs: [
          { key: 'treasury', label: 'TREASURY BALANCE (USD)', placeholder: '600000' },
          { key: 'deliveryCost', label: 'ESTIMATED DELIVERY COST (USD)', placeholder: '420000' },
        ],
        outputPass: 'Treasury: Funded for delivery ✅',
        outputFail: 'Treasury: Underfunded ❌',
      },
      {
        type: 'team_allocation_locked',
        label: 'Team Allocation Locked',
        description: 'Prove team tokens or funds are locked and cannot be withdrawn early',
        required: false,
        defaultEnabled: true,
        inputs: [{ key: 'lockMonths', label: 'LOCK DURATION (months)', placeholder: '12' }],
        outputPass: 'Team Locked: 12+ months ✅',
        outputFail: 'Team Locked: <12 months ❌',
      },
      {
        type: 'smart_contract_audited',
        label: 'Smart Contract Audited',
        description: 'Prove an independent audit was completed without naming the auditor',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'auditDate', label: 'AUDIT DATE (month/year)', placeholder: '03/2026', type: 'text' },
          { key: 'vulnerabilities', label: 'VULNERABILITIES FOUND', placeholder: '0' },
        ],
        outputPass: 'Audited: 0 critical issues ✅',
        outputFail: 'Audit: issues present ❌',
      },
      {
        type: 'royalty_committed',
        label: 'Royalty Committed',
        description: 'Prove royalty percentage is locked in the smart contract',
        required: false,
        defaultEnabled: false,
        inputs: [{ key: 'royaltyPct', label: 'ROYALTY PERCENTAGE (%)', placeholder: '5' }],
        outputPass: 'Royalty: Locked on-chain ✅',
        outputFail: 'Royalty: Not committed ❌',
      },
    ],
  },
  {
    type: 'airdrop',
    label: 'Airdrop Project',
    sublabel: 'Prove supply & vesting',
    icon: Rocket,
    attributes: [
      {
        type: 'treasury_solvent',
        label: 'Treasury Solvent',
        description: 'Prove operational treasury exists to run the airdrop',
        required: true,
        defaultEnabled: true,
        inputs: [
          { key: 'operationalTreasury', label: 'OPERATIONAL TREASURY (USD)', placeholder: '700000' },
          { key: 'airdropCosts', label: 'AIRDROP COSTS (USD)', placeholder: '500000' },
        ],
        outputPass: 'Treasury: Solvent ✅',
        outputFail: 'Treasury: Insolvent ❌',
      },
      {
        type: 'team_tokens_locked',
        label: 'Team Tokens Locked',
        description: 'Prove team token allocation has a vesting period — no day-1 dump',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'vestingMonths', label: 'VESTING PERIOD (months)', placeholder: '12' },
          { key: 'teamAllocationPct', label: 'TEAM ALLOCATION (%)', placeholder: '20' },
        ],
        outputPass: 'Vesting: 12+ months ✅',
        outputFail: 'Vesting: <12 months ❌',
      },
      {
        type: 'token_supply_committed',
        label: 'Token Supply Committed',
        description: 'Prove total token supply is fixed and cannot be inflated',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'totalSupply', label: 'TOTAL TOKEN SUPPLY', placeholder: '1000000000' },
          { key: 'circulatingPct', label: 'CIRCULATING AT LAUNCH (%)', placeholder: '25' },
        ],
        outputPass: 'Supply: Fixed & committed ✅',
        outputFail: 'Supply: Risky float ❌',
      },
      {
        type: 'distribution_timeline',
        label: 'Distribution Timeline',
        description: 'Prove airdrop will be distributed within a committed timeframe',
        required: false,
        defaultEnabled: false,
        inputs: [{ key: 'distributionDays', label: 'DISTRIBUTION DATE (days)', placeholder: '14' }],
        outputPass: 'Distribution: On schedule ✅',
        outputFail: 'Distribution: Delayed ❌',
      },
    ],
  },
  {
    type: 'dao',
    label: 'DAO',
    sublabel: 'Prove treasury & runway',
    icon: Users,
    attributes: [
      {
        type: 'treasury_solvency',
        label: 'Treasury Solvency',
        description: 'Prove DAO treasury can cover all committed expenditures',
        required: true,
        defaultEnabled: true,
        inputs: [
          { key: 'treasury', label: 'TREASURY BALANCE (USD)', placeholder: '1200000' },
          { key: 'committedExpenditure', label: 'COMMITTED EXPENDITURE (USD)', placeholder: '900000' },
        ],
        outputPass: 'Treasury: Solvent ✅',
        outputFail: 'Treasury: Insolvent ❌',
      },
      {
        type: 'operational_runway',
        label: 'Operational Runway',
        description: 'Prove DAO can fund operations for the next 6+ months',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'monthlyCost', label: 'MONTHLY BURN RATE (USD)', placeholder: '100000' },
          { key: 'cashReserves', label: 'CURRENT TREASURY (USD)', placeholder: '700000' },
        ],
        outputPass: 'Runway: 6+ months ✅',
        outputFail: 'Runway: <6 months ❌',
      },
      {
        type: 'contributor_pay_backed',
        label: 'Contributor Pay Backed',
        description: 'Prove contributor salaries are funded for the next quarter',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'monthlyContributorCosts', label: 'MONTHLY CONTRIBUTOR COSTS (USD)', placeholder: '60000' },
          { key: 'payReserve', label: 'PAY RESERVE (USD)', placeholder: '240000' },
        ],
        outputPass: 'Contributors: Funded ✅',
        outputFail: 'Contributors: Underfunded ❌',
      },
      {
        type: 'multi_sig_controlled',
        label: 'Multi-sig Controlled',
        description: 'Prove treasury requires multiple signers — not a single wallet',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'signers', label: 'NUMBER OF SIGNERS', placeholder: '5' },
          { key: 'requiredSignatures', label: 'SIGNATURES REQUIRED', placeholder: '3' },
        ],
        outputPass: 'Multi-sig: Active ✅',
        outputFail: 'Multi-sig: Weak ❌',
      },
    ],
  },
  {
    type: 'lending',
    label: 'Lending Platform',
    sublabel: 'Prove collateral & ratios',
    icon: BarChart3,
    attributes: [
      {
        type: 'reserve_ratio',
        label: 'Reserve Ratio',
        description: 'Prove your reserves exceed total customer liabilities',
        required: true,
        defaultEnabled: true,
        inputs: [
          { key: 'reserves', label: 'TOTAL RESERVES (USD)', placeholder: '1200000' },
          { key: 'liabilities', label: 'TOTAL LIABILITIES (USD)', placeholder: '850000' },
        ],
        outputPass: 'Above 120% ✅',
        outputFail: '❌ Below 120%',
      },
      {
        type: 'collateral_ratio',
        label: 'Collateral Ratio',
        description: 'Prove loans are backed by sufficient collateral',
        required: true,
        defaultEnabled: true,
        inputs: [
          { key: 'loans', label: 'TOTAL LOANS ISSUED (USD)', placeholder: '1200000' },
          { key: 'collateral', label: 'TOTAL COLLATERAL (USD)', placeholder: '2000000' },
        ],
        outputPass: 'Collateral Ratio: Above 150% ✅',
        outputFail: 'Collateral Ratio: Below 150% ❌',
      },
      {
        type: 'bad_debt_ratio',
        label: 'Bad Debt Ratio',
        description: 'Prove bad debt is below a safe threshold of total loans',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'totalLoans', label: 'TOTAL LOANS (USD)', placeholder: '1200000' },
          { key: 'badDebtAmount', label: 'BAD DEBT AMOUNT (USD)', placeholder: '30000' },
        ],
        outputPass: 'Bad Debt: Below 5% ✅',
        outputFail: 'Bad Debt: Above 5% ❌',
      },
      {
        type: 'smart_contract_audited',
        label: 'Smart Contract Audited',
        description: 'Prove an independent audit was completed without naming the auditor',
        required: false,
        defaultEnabled: true,
        inputs: [
          { key: 'auditDate', label: 'AUDIT DATE (month/year)', placeholder: '03/2026', type: 'text' },
          { key: 'vulnerabilities', label: 'VULNERABILITIES FOUND', placeholder: '0' },
        ],
        outputPass: 'Audited: 0 critical issues ✅',
        outputFail: 'Audit: issues present ❌',
      },
    ],
  },
];

export function defaultAttributeStates(category: CategoryTemplate): AttributeState[] {
  return category.attributes.map((attribute) => ({
    type: attribute.type,
    enabled: attribute.required ? true : attribute.defaultEnabled,
    required: attribute.required,
    inputs: Object.fromEntries(attribute.inputs.map((input) => [input.key, input.placeholder])),
  }));
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function evaluateAttributeState(
  template: AttributeTemplate,
  state: AttributeState,
  reserveRatio: number,
): { pass: boolean; output: string } {
  const inputs = state.inputs;
  const enabled = state.required ? true : state.enabled;
  if (!enabled) {
    return { pass: false, output: '(off)' };
  }

  if (template.type === 'reserve_ratio') {
    return reserveRatio >= 120 ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'operational_runway') {
    const pass = toNumber(inputs.cashReserves) / Math.max(1, toNumber(inputs.monthlyCost)) >= 6;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'fund_segregation') {
    const pass = toNumber(inputs.customerFunds) !== toNumber(inputs.operationalFunds);
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'solvency_band') {
    const pass = reserveRatio >= 120;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'smart_contract_audited') {
    const pass = toNumber(inputs.vulnerabilities) === 0;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'liquidity_depth') {
    const pass = toNumber(inputs.liquidityDepth) / Math.max(1, toNumber(inputs.tvl)) >= 0.4;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'collateral_ratio') {
    const pass = toNumber(inputs.collateral) / Math.max(1, toNumber(inputs.loans)) >= 1.5;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'treasury_funded') {
    const pass = toNumber(inputs.treasury) / Math.max(1, toNumber(inputs.deliveryCost)) >= 1;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'team_allocation_locked' || template.type === 'team_tokens_locked') {
    const pass = toNumber(inputs.lockMonths || inputs.vestingMonths) >= 12;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'royalty_committed') {
    const pass = toNumber(inputs.royaltyPct) > 0;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'treasury_solvent' || template.type === 'treasury_solvency') {
    const pass = toNumber(inputs.operationalTreasury || inputs.treasury) / Math.max(1, toNumber(inputs.airdropCosts || inputs.committedExpenditure)) >= 1;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'token_supply_committed') {
    const pass = toNumber(inputs.circulatingPct) <= 30;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'distribution_timeline') {
    const pass = toNumber(inputs.distributionDays) <= 30;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'contributor_pay_backed') {
    const pass = toNumber(inputs.payReserve) / Math.max(1, toNumber(inputs.monthlyContributorCosts)) >= 3;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'multi_sig_controlled') {
    const pass = toNumber(inputs.signers) >= 3 && toNumber(inputs.requiredSignatures) >= 2;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }
  if (template.type === 'bad_debt_ratio') {
    const pass = toNumber(inputs.badDebtAmount) / Math.max(1, toNumber(inputs.totalLoans)) <= 0.05;
    return pass ? { pass: true, output: template.outputPass } : { pass: false, output: template.outputFail };
  }

  return { pass: true, output: template.outputPass };
}
