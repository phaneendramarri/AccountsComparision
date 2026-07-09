export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2
  }).format(value);
}
