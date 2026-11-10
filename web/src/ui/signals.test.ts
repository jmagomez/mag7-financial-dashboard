import assert from "node:assert/strict";
import { test } from "node:test";
import { checks, signals, sortFindings, type AuditCompany, type AuditInput, type Finding } from "../lib/signals.ts";
import type { DailyFile, FundamentalsFile } from "../lib/merge.ts";
import { toHtml } from "../lib/vdom.ts";
import { buildModel } from "./model.ts";
import { auditBlock, integrityBlock, signalsBlock } from "./signals.ts";

const co = (t: string, o: Partial<AuditCompany> = {}): AuditCompany => ({
  ticker: t,
  marketCapB: 500,
  weight: 50,
  cds: 60,
  pd5: 5,
  annual: { revenueB: 100, netIncomeB: 20, netMargin: 20 },
  quarter: { revenueB: 25, netIncomeB: 5, operatingIncomeB: 6, netMargin: 20 },
  netCashB: 10,
  capexOcf: 30,
  fcfRecalc: true,
  fcfYield: 2,
  fcfYieldSrc: 2,
  ...o,
});
const base = (cs: AuditCompany[], o: Partial<AuditInput> = {}): AuditInput => ({
  generated: "2026-11-09",
  marketSnapshot: "2026-11-06",
  totalMarketCapT: 1,
  companies: cs,
  catalysts: [],
  cdsAsOf: { A: "2026-11-06", B: "2026-11-06" },
  snapshotCount: 14,
  snapshotLast: "2026-11-06",
  ...o,
});
const two = (a: Partial<AuditCompany> = {}, b: Partial<AuditCompany> = {}): AuditCompany[] => [co("A", a), co("B", b)];
const sig = (a: AuditInput, label: string) => signals(a).find((s) => s.label === label);

test("sinal de crédito: alerta só acima de 100 bps; sem alerta mostra o maior CDS", () => {
  assert.equal(sig(base(two()), "Alerta de crédito")?.tone, "ok");
  assert.match(sig(base(two()), "Alerta de crédito")?.detail ?? "", /Maior CDS: A 60 bps/);
  const s = sig(base(two({ cds: 139 })), "Alerta de crédito");
  assert.equal(s?.tone, "alert");
  assert.match(s?.value ?? "", /A 139 bps/);
  assert.match(sig(base(two({ cds: null }, { cds: null })), "Alerta de crédito")?.detail ?? "", /Sem CDS/);
  assert.equal(sig(base(two({ cds: 100 })), "Alerta de crédito")?.tone, "ok"); // 100 não é "acima de"
});

test("qualidade do lucro: líquido > 1,5× operacional (operacional > 0) dispara", () => {
  const q = (net: number, op: number) => ({ quarter: { operatingIncomeB: op, netIncomeB: net } });
  assert.equal(sig(base(two(q(9, 6))), "Qualidade do lucro (trimestre)")?.tone, "ok"); // exatamente 1,5×
  assert.equal(sig(base(two(q(9.1, 6))), "Qualidade do lucro (trimestre)")?.tone, "alert");
  assert.equal(sig(base(two(q(5, -1))), "Qualidade do lucro (trimestre)")?.tone, "ok"); // operacional ≤ 0 não conta
  assert.equal(sig(base(two({ quarter: undefined })), "Qualidade do lucro (trimestre)")?.tone, "ok");
});

test("pressão de CapEx: maior valor; alerta a partir de 80%; some se ninguém tem dado", () => {
  assert.equal(sig(base(two({ capexOcf: 79.9 })), "Maior pressão de CapEx")?.tone, "neutral");
  const s = sig(base(two({ capexOcf: 80 }, { capexOcf: 92.3 })), "Maior pressão de CapEx");
  assert.equal(s?.tone, "alert");
  assert.match(s?.value ?? "", /^B · 92%/);
  assert.equal(sig(base(two({ capexOcf: null }, { capexOcf: null })), "Maior pressão de CapEx"), undefined);
});

test("balanço: caixa líquido negativo dispara e lista valores", () => {
  const s = sig(base(two({ netCashB: -5.5 })), "Balanço (caixa líquido)");
  assert.equal(s?.tone, "alert");
  assert.match(s?.value ?? "", /A -5,5 bi/);
  assert.equal(sig(base(two({ netCashB: null })), "Balanço (caixa líquido)")?.tone, "ok");
});

test("próximo resultado: ignora feito e passado, ordena por data, conta dias a partir de generated", () => {
  const cat = [
    { ticker: "X", date: "2026-11-01", event: "passado" },
    { ticker: "Y", date: "2026-11-20", event: "feito", done: true },
    { ticker: "N", date: "2026-11-17", event: "Resultado", confirmed: true },
    { ticker: "Z", date: "2026-12-30", event: "longe" },
  ];
  const s = sig(base(two(), { catalysts: cat }), "Próximo resultado");
  assert.match(s?.value ?? "", /^N · 17\/11 \(em 8 d\)$/);
  assert.equal(s?.tone, "neutral");
  assert.ok(!(s?.detail ?? "").includes("não confirmada"));
  assert.equal(sig(base(two(), { catalysts: [{ ticker: "N", date: "2026-11-12", event: "e" }] }), "Próximo resultado")?.tone, "alert"); // ≤ 7 d
  assert.match(sig(base(two(), { catalysts: [{ ticker: "N", date: "2026-11-12", event: "e" }] }), "Próximo resultado")?.detail ?? "", /não confirmada/);
  assert.equal(sig(base(two()), "Próximo resultado"), undefined);
  assert.match(sig(base(two(), { catalysts: [{ ticker: "N", date: "2026-11-09", event: "hoje" }] }), "Próximo resultado")?.value ?? "", /em 0 d/);
});

test("checagens: base saudável passa tudo; cada violação é pega", () => {
  assert.ok(checks(base(two())).every((c) => c.ok));
  const bad = (a: AuditInput, i: number) => checks(a)[i];
  assert.equal(bad(base(two(), { totalMarketCapT: 2 }), 0)?.ok, false);
  assert.equal(bad(base(two({ weight: 70 })), 1)?.ok, false);
  assert.match(bad(base(two({ weight: 70 })), 1)?.detail ?? "", /Divergem: A/);
  assert.equal(bad(base(two({ annual: { revenueB: 100, netIncomeB: 20, netMargin: 21 } })), 2)?.ok, false);
  assert.equal(bad(base(two({ quarter: { revenueB: 0, netIncomeB: 1, netMargin: 99 } })), 2)?.ok, true); // receita 0: não dá para checar
  assert.equal(bad(base(two({ fcfYield: 3, fcfYieldSrc: 2 })), 3)?.ok, false);
  assert.match(bad(base(two({ fcfYield: 3, fcfYieldSrc: 2 })), 3)?.detail ?? "", /A \(2,0% → 3,0%\)/);
  assert.equal(bad(base(two({ fcfRecalc: false })), 4)?.ok, false);
  assert.equal(bad(base(two(), { marketSnapshot: "2026-10-20" }), 5)?.ok, false); // 20 dias
  assert.equal(bad(base(two(), { marketSnapshot: "2026-10-26" }), 5)?.ok, true); // 14 dias
  assert.equal(bad(base(two(), { cdsAsOf: { A: "2026-07-01", B: "2026-11-06" } }), 6)?.ok, false);
  assert.equal(bad(base(two(), { cdsAsOf: { B: "2026-11-06" } }), 6)?.ok, false); // A tem CDS e não tem data
  assert.match(bad(base(two(), { cdsAsOf: { B: "2026-11-06" } }), 6)?.detail ?? "", /Sem data: A/);
  assert.equal(bad(base(two(), { snapshotCount: 1 }), 7)?.ok, false);
  assert.equal(bad(base(two(), { snapshotCount: null }), 7)?.ok, false);
});

test("auditoria: ordena por severidade sem mutar a entrada; severidade desconhecida vai ao fim", () => {
  const f = (sev: string, area: string): Finding => ({ sev: sev as Finding["sev"], area, finding: "", action: "" });
  const input = [f("baixa", "1"), f("alta", "2"), f("média", "3"), f("alta", "4"), f("zzz", "5")];
  const out = sortFindings(input);
  assert.deepEqual(out.map((x) => x.area), ["2", "4", "3", "1", "5"]);
  assert.deepEqual(input.map((x) => x.area), ["1", "2", "3", "4", "5"]);
});

test("blocos: texto injetado em achados/eventos é escapado; nada de innerHTML", () => {
  const daily = {
    meta: {
      generated: "2026-11-09",
      marketSnapshot: "2026-11-06",
      totalMarketCapT: 1,
      audit: [{ sev: "alta", area: "<img src=x onerror=1>", finding: "achado <script>x</script>", action: "ação" }],
      catalysts: [{ ticker: "AAA", date: "2026-11-17", event: "<b>evento</b>", confirmed: false }],
    },
    companies: [{ ticker: "AAA", price: 1, marketCapB: 1000, weight: 100, cds: 150 }],
  } as unknown as DailyFile;
  const fund = {
    companies: [{ ticker: "AAA", name: "Alfa", revHistory: [1], niHistory: [1], fcfAnnual: [1], capex: [1], valuation: {}, quarter: { operatingIncomeB: 1, netIncomeB: 9 } }],
    derived: { balanceQ2_2026: { AAA: { cash: 1, debt: 5 } }, fcfTTM: {}, fwdPE: {}, ebitdaImplB: {}, fwdEPS: {}, oneOffTTM: {} },
  } as unknown as FundamentalsFile;
  const m = buildModel(daily, fund, { snapshots: [] });
  const html = toHtml(signalsBlock(m)) + toHtml(integrityBlock(m)) + toHtml(auditBlock(m) as never);
  assert.ok(!html.includes("<script>x") && !html.includes("<img") && !html.includes("<b>evento"));
  assert.ok(html.includes("&lt;script&gt;") && html.includes("&lt;b&gt;evento"));
  assert.ok(html.includes("(atenção)")); // o tom aparece em palavra, não só em cor
  assert.ok(html.includes("1 alta(s) de 1"));
  assert.ok(html.includes("⚠ atenção")); // FCF TTM ausente reprova a checagem
  assert.equal(auditBlock(buildModel({ ...daily, meta: { ...daily.meta, audit: [] } }, fund, null)), null);
});
