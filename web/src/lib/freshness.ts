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

/** Resultados trimestrais: DECISÃO DE DESIGN da v2. Até 91 d após o fim do trimestre ainda não há trimestre mais novo;
 * até 135 d o seguinte já fechou e a divulgação está pendente; depois disso o dado está defasado. */
export const QUARTER_FRESH_MAX_DAYS = 91;
export const QUARTER_STALE_AFTER_DAYS = 135;

/** "Q2 2026" → "2026-06-30" (último dia do trimestre-calendário); rótulo fora do formato → null. */
export function quarterEnd(label: string | null | undefined): string | null {
  const m = /^Q([1-4]) (\d{4})$/.exec(label ?? "");
  if (!m) return null;
  const q = Number(m[1]);
  const last = new Date(Date.UTC(Number(m[2]), q * 3, 0));
  return last.toISOString().slice(0, 10);
}

/** Chip para os dados trimestrais (resultados, valuation, histórico). Sem rótulo válido: defasado, nunca "atual" por omissão. */
export function quarterChip(label: string | null | undefined, ref: string): Chip {
  const end = quarterEnd(label);
  if (!end) return { level: "stale", text: "defasado · resultados sem trimestre válido" };
  const age = ageDays(end, ref);
  const level: Level = age <= QUARTER_FRESH_MAX_DAYS ? "fresh" : age <= QUARTER_STALE_AFTER_DAYS ? "aging" : "stale";
  return { level, text: `${WORD[level]} · resultados de ${label} · ${age} d após o fim do trimestre` };
}
