/**
 * Sensibilidade do DCF reverso ao WACC: o crescimento de FCF que o EV atual embute, recalculado com o WACC de cada empresa
 * deslocado em passos fixos (em pontos percentuais). Só reaproveita `impliedGrowth` e `waccOf`; nenhuma entrada nova.
 * A coluna do passo 0 é, por construção, o mesmo número do gráfico "O que está no preço".
 */
import { impliedGrowth, waccOf } from "./finance.ts";
import type { CompanyInput, Derived } from "../types.ts";

/** Deslocamentos do WACC, em pontos percentuais (decisão de apresentação: ±1 e ±2 p.p. cobrem a incerteza usual de beta e prêmio de risco). */
export const WACC_STEPS: readonly number[] = [-2, -1, 0, 1, 2];

export interface SensRow {
  ticker: string;
  /** WACC central (%): o da empresa (CAPM) ou, sem `waccInputs`, o único de `dcfAssumptions` (padrão 9). */
  baseWaccPct: number;
  /** true = WACC por empresa; false = WACC único. */
  perCompany: boolean;
  /** Crescimento implícito (% a.a.) em cada passo de WACC; null = não significativo (FCF ≤ 0, WACC ≤ g terminal ou > 30% a.a.). */
  cells: (number | null)[];
}

/** Linhas só das empresas com balanço (sem ele não há EV); mesma conta de EV e FCF de `deriveCompany`. */
export function sensitivityRows(companies: readonly CompanyInput[], d: Derived, steps: readonly number[] = WACC_STEPS): SensRow[] {
  const out: SensRow[] = [];
  for (const c of companies) {
    const bal = d.balanceQ2_2026[c.ticker];
    if (!bal) continue;
    const net = Math.round((bal.cash - bal.debt) * 10) / 10;
    const ev = c.marketCapB - net;
    const fcf = d.fcfTTM[c.ticker];
    const w = waccOf(c, d);
    const base = w ? w.waccPct : (d.dcfAssumptions?.waccPct ?? 9);
    out.push({ ticker: c.ticker, baseWaccPct: base, perCompany: w !== null, cells: steps.map((s) => impliedGrowth(ev, fcf, { ...d.dcfAssumptions, waccPct: base + s })) });
  }
  return out;
}
