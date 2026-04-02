export type SolvencyStatus = 'SOLVENT' | 'WARNING' | 'INSOLVENT';

export function ratioBandFromStatus(status: SolvencyStatus): string {
  if (status === 'SOLVENT') return 'Above 120%';
  if (status === 'WARNING') return '100–120%';
  return 'Below 100%';
}

export function statusColors(status: SolvencyStatus): { bg: string; text: string; border: string } {
  if (status === 'SOLVENT') {
    return { bg: 'rgba(22,163,74,0.1)', text: '#16A34A', border: 'rgba(22,163,74,0.3)' };
  }
  if (status === 'WARNING') {
    return { bg: 'rgba(202,138,4,0.1)', text: '#CA8A04', border: 'rgba(202,138,4,0.3)' };
  }
  return { bg: 'rgba(220,38,38,0.1)', text: '#DC2626', border: 'rgba(220,38,38,0.3)' };
}

export function statusDotClass(status: SolvencyStatus): string {
  if (status === 'SOLVENT') return 'bg-[var(--solvent)]';
  if (status === 'WARNING') return 'bg-[var(--warning)]';
  return 'bg-[var(--insolvent)]';
}
