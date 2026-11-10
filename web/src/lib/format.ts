const cache = new Map<number, Intl.NumberFormat>();

/** Número em pt-BR com `digits` casas; null/NaN/∞ viram "n/d" (nunca um zero que pareça dado). */
export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/d";
  let f = cache.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(digits, f);
  }
  return f.format(n);
}

/** "2026-11-06" → "06/11". */
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "2026-11-09" → "09/11/2026". */
export const fmtDateFull = (iso: string): string => iso.split("-").reverse().join("/");
