/**
 * Formatting helpers. Hand-rolled instead of Intl.NumberFormat: they run on every
 * tick for every visible row, and Hermes' Intl is comparatively slow.
 */

function groupThousands(intPart: string): string {
  let out = '';
  for (let i = 0; i < intPart.length; i++) {
    if (i > 0 && (intPart.length - i) % 3 === 0) out += ',';
    out += intPart[i];
  }
  return out;
}

export function formatFixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '—';
  const negative = value < 0;
  const [int = '0', frac] = Math.abs(value).toFixed(decimals).split('.');
  return `${negative ? '-' : ''}${groupThousands(int)}${frac ? `.${frac}` : ''}`;
}

/** Decimals that suit the magnitude: 64,238.17 / 150.42 / 0.16234 / 0.000012. */
export function priceDecimals(price: number): number {
  const abs = Math.abs(price);
  if (abs >= 1000) return 2;
  if (abs >= 1) return abs >= 100 ? 2 : 3;
  if (abs >= 0.01) return 5;
  return 8;
}

export function formatPrice(price: number, decimals = priceDecimals(price)): string {
  return formatFixed(price, decimals);
}

/** Percent with enough significant digits for tiny values (e.g. BTC spreads ~0.00001%). */
export function formatSmallPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0%';
  return Math.abs(value) >= 0.01 ? `${value.toFixed(3)}%` : `${Number(value.toPrecision(2))}%`;
}

export function formatPercent(value: number, decimals = 2, withSign = false): string {
  if (!Number.isFinite(value)) return '—';
  const sign = withSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatQuantity(qty: number): string {
  if (qty >= 1_000_000) return formatCompact(qty);
  if (qty >= 1000) return formatFixed(qty, 2);
  if (qty >= 1) return qty.toFixed(4);
  return qty.toFixed(5);
}

const UNITS: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

export function formatCompact(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  for (const [size, unit] of UNITS) {
    if (abs >= size) return `${(value / size).toFixed(decimals)}${unit}`;
  }
  return value.toFixed(abs < 10 ? 2 : 0);
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** HH:MM:SS.mmm in local time. */
export function formatClock(epochMs: number): string {
  if (!epochMs) return '—';
  const d = new Date(epochMs);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
