/**
 * Sinais e checagens de consistência calculados a partir dos dados (sem texto editorial). Porta as regras do painel
 * atual (index.html: renderSignals / renderIntegrity). Diferença deliberada: a referência de data é `meta.generated`
 * (determinística e testável), não o relógio do navegador.
 */
import { CDS_ALERT } from "./finance.ts";
import { fmtDate, fmtDateFull, fmtNum } from "./format.ts";
import { ageDays, CDS_STALE_AFTER_DAYS } from "./freshness.ts";

/** A partir deste CapEx ÷ OCF (%) o CapEx consome quase todo o caixa operacional (limiar do painel atual). */
export const CAPEX_OCF_WARN = 80;
export const EARNINGS_DISTORTION = 1.5;
/** Preços/market cap com mais de 14 dias reprovam a checagem de frescor (limiar do painel atual). */
export const PRICE_MAX_AGE_DAYS = 14;

export interface Period {
  revenueB?: number;
  netIncomeB?: number;
  operatingIncomeB?: number;
  netMargin?: number;
}
export interface AuditCompany {
  ticker: string;
  marketCapB: number;
  weight: number;
  cds: number | null;
  pd5: number | null;
  annual?: Period;
  quarter?: Period;
  netCashB: number | null;
  capexOcf: number | null;
  fcfRecalc: boolean;
  fcfYield: number | null;
  fcfYieldSrc: number | null;
}
export interface Catalyst {
  ticker: string;
  date: string;
  event: string;
  confirmed?: boolean;
  done?: boolean;
}
export interface AuditInput {
  generated: string;
  marketSnapshot: string;
  totalMarketCapT: number;
  companies: AuditCompany[];
  catalysts: Catalyst[];
  cdsAsOf: Record<string, string>;
  snapshotCount: number | null;
  snapshotLast: string | null;
}

export type Tone = "alert" | "ok" | "neutral";
export interface Signal {
  tone: Tone;
  label: string;
  value: string;
  detail: string;
}
export interface Check {
  title: string;
  ok: boolean;
  detail: string;
}

const list = (xs: string[]): string => xs.join(" · ");

export function signals(a: AuditInput): Signal[] {
  const cs = a.companies;
  const out: Signal[] = [];

  const withCds = cs.filter((c) => c.cds !== null).sort((x, y) => (y.cds as number) - (x.cds as number));
  const over = withCds.filter((c) => (c.cds as number) > CDS_ALERT);
  const top = withCds[0];
  out.push(
    over.length
      ? { tone: "alert", label: "Alerta de crédito", value: `⚠ ${list(over.map((c) => `${c.ticker} ${fmtNum(c.cds, 0)} bps`))}`, detail: `CDS 5a acima do limiar de ${CDS_ALERT} bps (mesma regra do e-mail).` }
      : {
          tone: "ok",
          label: "Alerta de crédito",
          value: `Nenhuma acima de ${CDS_ALERT} bps`,
          detail: top ? `Maior CDS: ${top.ticker} ${fmtNum(top.cds, 0)} bps (PD 5a implícita ~${fmtNum(top.pd5, 1)}%).` : "Sem CDS disponível.",
        },
  );

  const infl = cs.filter((c) => {
    const q = c.quarter;
    return q?.operatingIncomeB !== undefined && q.netIncomeB !== undefined && q.operatingIncomeB > 0 && q.netIncomeB > EARNINGS_DISTORTION * q.operatingIncomeB;
  });
  out.push({
    tone: infl.length ? "alert" : "ok",
    label: "Qualidade do lucro (trimestre)",
    value: infl.length ? list(infl.map((c) => c.ticker)) : "Sem distorções relevantes",
    detail: infl.length ? "Lucro líquido > 1,5× o operacional: ganhos não operacionais inflam o GAAP (P/E TTM enganoso)." : "Lucro líquido ≤ 1,5× o operacional em todas.",
  });

  const cx = cs.filter((c) => c.capexOcf !== null).sort((x, y) => (y.capexOcf as number) - (x.capexOcf as number))[0];
  if (cx) {
    out.push({
      tone: (cx.capexOcf as number) >= CAPEX_OCF_WARN ? "alert" : "neutral",
      label: "Maior pressão de CapEx",
      value: `${cx.ticker} · ${fmtNum(cx.capexOcf, 0)}% do caixa operacional`,
      detail: "CapEx ÷ (FCF + CapEx), último ano fiscal. Quanto mais perto de 100%, menos sobra de FCF.",
    });
  }

  const neg = cs.filter((c) => c.netCashB !== null && c.netCashB < 0);
  out.push({
    tone: neg.length ? "alert" : "ok",
    label: "Balanço (caixa líquido)",
    value: neg.length ? list(neg.map((c) => `${c.ticker} ${fmtNum(c.netCashB, 1)} bi`)) : "Todas com caixa líquido positivo",
    detail: neg.length ? "Dívida financiada > caixa + títulos (último balanço)." : "Caixa + títulos > dívida financiada.",
  });

  const next = a.catalysts.filter((e) => !e.done && e.date >= a.generated).sort((x, y) => x.date.localeCompare(y.date))[0];
  if (next) {
    const dd = -ageDays(next.date, a.generated);
    out.push({
      tone: dd <= 7 ? "alert" : "neutral",
      label: "Próximo resultado",
      value: `${next.ticker} · ${fmtDate(next.date)} (em ${dd} d)`,
      detail: `${next.event}${next.confirmed ? "" : " — data não confirmada"}. Cada divulgação invalida TTM, balanço e múltiplos. Contagem a partir de ${fmtDateFull(a.generated)}.`,
    });
  }
  return out;
}

const marginOff = (p: Period | undefined): boolean =>
  p !== undefined && p.netIncomeB !== undefined && p.revenueB !== undefined && p.revenueB > 0 && p.netMargin !== undefined && Math.abs((p.netIncomeB / p.revenueB) * 100 - p.netMargin) > 0.3;

export function checks(a: AuditInput): Check[] {
  const cs = a.companies;
  const rows: Check[] = [];
  const total = a.totalMarketCapT * 1000;

  const sum = cs.reduce((s, c) => s + c.marketCapB, 0);
  rows.push({ title: "Soma dos market caps = total do grupo", ok: Math.abs(sum - total) <= 2, detail: `Σ = US$ ${fmtNum(sum, 0)} bi vs total declarado US$ ${fmtNum(total, 0)} bi` });

  const badW = cs.filter((c) => Math.abs((c.weight / 100) * total - c.marketCapB) > 2).map((c) => c.ticker);
  rows.push({ title: "Peso × total = market cap", ok: badW.length === 0, detail: badW.length ? `Divergem: ${badW.join(", ")}` : `Todas as ${cs.length} reconciliam (±US$ 2 bi)` });

  const badM = cs.filter((c) => marginOff(c.annual) || marginOff(c.quarter)).map((c) => c.ticker);
  rows.push({ title: "Margem líquida = lucro ÷ receita (FY e trimestre)", ok: badM.length === 0, detail: badM.length ? `Divergem: ${badM.join(", ")}` : "Todas reconciliam (±0,3 p.p.)" });

  const badF = cs.filter((c) => c.fcfRecalc && c.fcfYield !== null && c.fcfYieldSrc !== null && Math.abs(c.fcfYieldSrc - c.fcfYield) > 0.3);
  rows.push({
    title: "FCF yield declarado = FCF TTM ÷ market cap",
    ok: badF.length === 0,
    detail: badF.length ? `Declarado era defasado em ${badF.map((c) => `${c.ticker} (${fmtNum(c.fcfYieldSrc, 1)}% → ${fmtNum(c.fcfYield, 1)}%)`).join(", ")} — o painel usa o valor recalculado.` : "Reconcilia (±0,3 p.p.)",
  });

  const noF = cs.filter((c) => !c.fcfRecalc).map((c) => c.ticker);
  rows.push({ title: "FCF TTM auditado disponível", ok: noF.length === 0, detail: noF.length ? `${noF.join(", ")}: sem FCF TTM em derived.fcfTTM — FCF yield mostra o valor declarado, não auditado.` : "Todas" });

  const age = ageDays(a.marketSnapshot, a.generated);
  rows.push({ title: `Frescor de preços/market cap (≤ ${PRICE_MAX_AGE_DAYS} dias)`, ok: age <= PRICE_MAX_AGE_DAYS, detail: `Snapshot de ${fmtDateFull(a.marketSnapshot)} (${age} dias antes do arquivo)` });

  const old = Object.keys(a.cdsAsOf).filter((t) => ageDays(a.cdsAsOf[t] as string, a.generated) > CDS_STALE_AFTER_DAYS);
  const semData = cs.filter((c) => c.cds !== null && !a.cdsAsOf[c.ticker]).map((c) => c.ticker);
  const cdsDetail = `${old.length ? `Defasadas: ${old.map((t) => `${t} (${fmtDateFull(a.cdsAsOf[t] as string)})`).join(", ")}. ` : ""}${semData.length ? `Sem data: ${semData.join(", ")}.` : ""}`.trim();
  rows.push({ title: `Cotações de CDS com ≤ ${CDS_STALE_AFTER_DAYS} dias e datadas`, ok: old.length === 0 && semData.length === 0, detail: cdsDetail || "Todas datadas e recentes" });

  if (a.snapshotCount === null) rows.push({ title: "Snapshots diários acumulados (history/snapshots.json)", ok: false, detail: "Arquivo indisponível" });
  else rows.push({ title: "Snapshots diários acumulados (history/snapshots.json)", ok: a.snapshotCount >= 2, detail: `${a.snapshotCount} snapshot(s)${a.snapshotLast ? ` · último ${fmtDateFull(a.snapshotLast)}` : ""}` });
  return rows;
}

export interface Finding {
  sev: "alta" | "média" | "baixa";
  area: string;
  finding: string;
  action: string;
}
const ORDER: Record<string, number> = { alta: 0, média: 1, baixa: 2 };
/** Ordena por severidade sem alterar o array de entrada; severidade desconhecida vai para o fim. */
export const sortFindings = (xs: readonly Finding[]): Finding[] => xs.map((x, i) => ({ x, i })).sort((p, q) => (ORDER[p.x.sev] ?? 9) - (ORDER[q.x.sev] ?? 9) || p.i - q.i).map((o) => o.x);
