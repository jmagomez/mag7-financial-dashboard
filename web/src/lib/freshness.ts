/**
 * Idade dos dados. A referência é sempre `meta.generated` (data do arquivo), nunca o relógio do navegador:
 * o resultado é determinístico e testável. Os limites abaixo são DECISÕES DE DESIGN da v2, não regra de mercado.
 */
const DAY = 86_400_000;
export const FRESH_MAX_DAYS = 7;
export const CDS_STALE_AFTER_DAYS = 30;

export type Level = "fresh" | "aging" | "stale";
export interface Chip {
  level: Level;
  text: string;
}

const WORD: Record<Level, string> = { fresh: "atual", aging: "atenção", stale: "defasado" };

function toUtc(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`data inválida: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export const ageDays = (asOf: string, ref: string): number => Math.round((toUtc(ref) - toUtc(asOf)) / DAY);

/** Dias úteis (seg–sex) em (from, to]. Sem calendário de feriados: é uma aproximação declarada. */
export function tradingDays(from: string, to: string): number {
  let n = 0;
  for (let t = toUtc(from) + DAY; t <= toUtc(to); t += DAY) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export function levelOf(age: number, staleAfter: number = CDS_STALE_AFTER_DAYS): Level {
  if (age <= FRESH_MAX_DAYS) return "fresh";
  return age <= staleAfter ? "aging" : "stale";
}

/** Chip de idade para um dado com data própria. O nível também vai em palavra: a cor nunca é o único sinal. */
export function ageChip(asOf: string | null | undefined, ref: string, staleAfter: number = CDS_STALE_AFTER_DAYS): Chip {
  if (!asOf) return { level: "stale", text: "defasado · sem data" };
  const age = ageDays(asOf, ref);
  const level = levelOf(age, staleAfter);
  const [, m, d] = asOf.split("-");
  return { level, text: `${WORD[level]} · ${d}/${m} · ${age} d` };
}
