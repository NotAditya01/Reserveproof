import type { SolvencyStatus } from '../lib/reserve';
import { statusColors } from '../lib/reserve';

export default function SolvencyBadge({ status, large = false }: { status: SolvencyStatus; large?: boolean }) {
  const colors = statusColors(status);
  return (
    <span
      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] ${
        large ? 'text-[11px]' : ''
      }`}
      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
    >
      {status}
    </span>
  );
}
