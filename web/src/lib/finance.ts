/**
 * Núcleo financeiro do dashboard: funções PURAS (sem DOM, sem fetch), com paridade numérica
 * verificada contra o index.html em produção (tests/golden/derived_golden.json).
 *
 * Convenções (iguais às do dashboard atual, de propósito, para a migração não mudar números):
 *  - valores em US$ bilhões; percentuais em pontos (7,99 = 7,99%);
 *  - arredondamento "meio para cima" a 1 casa (Math.round(x*10)/10), como o front em produção;
 *  - `null` = não calculável (dado ausente ou sem significado), nunca zero nem NaN.
 */
import { computeWacc, type WaccRow } from "./wacc.ts";
import type { CompanyInput, DcfAssumptions, Derived, DerivedResult, Ticker } from "../types.ts";

/** Recuperação assumida na PD implícita do CDS (mesma constante de src/common.py: CDS_R). */
export const CDS_R = 0.4;
/** Limiar de alerta de CDS em bps (src/common.py: CDS_ALERT). */
export const CDS_ALERT = 100;

const round1 = (x: number): number => Math.round(x * 10) / 10;

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Soma dos últimos `n` pontos (TTM = 4 trimestres). Exige n pontos: série curta -> null. */
export function trailing(xs: readonly number[], n = 4): number | null {
  return xs.length >= n ? sum(xs.slice(-n)) : null;
}

/**
 * PD acumulada em `years` anos implícita no CDS, em %: 1 − exp(−T·s/(1−R)).
 * Aproximação de taxa de risco constante e NEUTRA AO RISCO (inclui prêmio de risco e de
 * liquidez): serve para comparar emissores, não como previsão de default.
 */
export function pd5(bps: number | null | undefined, recovery = CDS_R): number | null {
  if (bps == null) return null;
  return Math.round((1 - Math.exp((-5 * (bps / 1e4)) / (1 - recovery))) * 1000) / 10;
}

/**
 * DCF reverso: CAGR de FCF (em %, 1 casa) nos próximos N anos que iguala o valor presente
 * (FCF projetado + valor terminal de Gordon) ao EV atual.
 * Retorna null ("n/s") se FCF ≤ 0, EV ≤ 0, WACC ≤ g terminal, ou se o EV exigiria > 30% a.a.
 */
export function impliedGrowth(ev: number, fcf: number | undefined, a: DcfAssumptions = {}): number | null {
  const w = (a.waccPct ?? 9) / 100;
  const gt = (a.terminalGrowthPct ?? 3) / 100;
  const n = a.years ?? 10;
  if (fcf === undefined || !(fcf > 0) || !(ev > 0) || !(w > gt)) return null;
  const pv = (g: number): number => {
    let acc = 0;
    for (let t = 1; t <= n; t++) acc += fcf * Math.pow((1 + g) / (1 + w), t);
    const fcfN = fcf * Math.pow(1 + g, n);
    const tv = (fcfN * (1 + gt)) / (w - gt);
    return acc + tv / Math.pow(1 + w, n);
  };
  if (pv(0.3) < ev) return null;
  let lo = -0.3;
  let hi = 0.9;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) < ev) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 1000) / 10;
}

/** WACC da empresa (CAPM, `derived.waccInputs`); null sem entradas válidas → vale o WACC único de `dcfAssumptions`. */
export function waccOf(c: CompanyInput, d: Derived): WaccRow | null {
  const bal = d.balanceQ2_2026[c.ticker];
  return d.waccInputs && bal ? computeWacc(c.ticker, c.marketCapB, bal.debt, c.rating?.sp, d.waccInputs) : null;
}

/** Deriva os indicadores de UMA empresa a partir das entradas auditáveis (`derived`). */
export function deriveCompany(c: CompanyInput, d: Derived): DerivedResult {
  const ttmNi = trailing(c.niHistory);
  const ttmRev = trailing(c.revHistory);
  const oneOff = d.oneOffTTM[c.ticker];
  const bal = d.balanceQ2_2026[c.ticker];
  const fcf = d.fcfTTM[c.ticker];

  const pe = ttmNi !== null && ttmNi > 0 ? round1(c.marketCapB / ttmNi) : null; // lucro TTM ≤ 0: P/E sem significado
  const peCore = oneOff !== undefined && ttmNi !== null ? round1(c.marketCapB / (ttmNi - oneOff)) : null;

  let net: number | null = null;
  let ev: number | null = null;
  let evSales: number | null = null;
  let impliedG: number | null = null;
  if (bal) {
    net = round1(bal.cash - bal.debt);
    const evExact = c.marketCapB - net;
    ev = Math.round(evExact);
    evSales = ttmRev !== null ? round1(evExact / ttmRev) : null;
    const w = waccOf(c, d);
    impliedG = impliedGrowth(evExact, fcf, w ? { ...d.dcfAssumptions, waccPct: w.waccPct } : d.dcfAssumptions);
  }

  const ebitda = d.ebitdaImplB[c.ticker];
  const evEbitda = ebitda !== undefined && ebitda > 0 && ev !== null ? round1(ev / ebitda) : null;
  const fwdEps = d.fwdEPS[c.ticker];
  const fwdRef = d.fwdPE[c.ticker];
  // P/E forward: reescala ao preço atual quando há LPA forward implícito; senão, usa o consenso.
  const peFwd = fwdEps !== undefined && fwdEps > 0 ? round1(c.price / fwdEps) : (fwdRef ?? null);

  // FCF yield recalculado do FCF TTM auditado; sem ele, mantém o valor declarado (não auditado).
  const fcfRecalc = fcf !== undefined;
  const fcfB = fcfRecalc ? fcf : (c.valuation.fcfB ?? null);
  const fcfYield = fcfRecalc ? Math.round((fcf / c.marketCapB) * 1000) / 10 : (c.valuation.fcfYield ?? null);

  // CapEx ÷ OCF, FY mais recente; OCF ≈ FCF + CapEx.
  const f = c.fcfAnnual.at(-1);
  const cx = c.capex.at(-1);
  const ocf = f !== undefined && cx !== undefined ? f + cx : null;
  const capexOcf = ocf !== null && cx !== undefined && ocf > 0 ? Math.round((cx / ocf) * 1000) / 10 : null;

  return {
    ticker: c.ticker,
    valuation: {
      pe,
      peCore,
      peFwd,
      ev,
      evSales,
      evEbitda,
      net,
      netPct: net !== null ? Math.round((net / c.marketCapB) * 1000) / 10 : null,
      impliedG,
      fcfYield,
      fcfB,
    },
    capexOcf,
    pd5: pd5(c.cds),
  };
}

export function deriveAll(cs: readonly CompanyInput[], d: Derived): Record<Ticker, DerivedResult> {
  return Object.fromEntries(cs.map((c) => [c.ticker, deriveCompany(c, d)])) as Record<Ticker, DerivedResult>;
}
