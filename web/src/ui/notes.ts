/**
 * Notas editoriais da aba Histórico, portadas sem alteração de conteúdo do painel atual (index.html).
 * São texto fixo escrito por pessoas, não dado calculado: ao mudarem, devem ser revistas junto com os dados trimestrais.
 */
import { h, type Child } from "../lib/vdom.ts";

export type Note = Child[];

export const HIST_NOTES: Note[] = [
  ["Séries por trimestre-calendário; Nvidia tem trimestres fiscais deslocados ~1 mês (aproximados)."],
  ["Lucro GAAP: Apple Q3'24 (imposto UE ~US$ 10 bi) e Meta Q3'25 (imposto ~US$ 15,9 bi) reduzem pontualmente o resultado; ganhos de investimento elevam Amazon/Alphabet em 2025–26."],
  [h("b", {}, "2T'26:"), " os picos de lucro de Alphabet (US$ 112 bi) e Amazon (US$ 63 bi) vêm de ganhos NÃO realizados com participações (~US$ 77 bi e ~US$ 53 bi, sem caixa); nesses trimestres a margem não reflete a operação — compare pelo lucro operacional."],
];

export const FCF_NOTES: Note[] = [
  ["FCF por ano fiscal (real). O FCF de um único trimestre é sazonal e reportado de forma inconsistente entre fontes; por isso a granularidade anual."],
  ["Amazon caiu de US$ 38 bi (FY24) para ~US$ 11 bi (FY25) por CapEx de IA; Nvidia saltou de US$ 3,8 bi (FY23) a US$ 60,9 bi (FY25)."],
];

export const CAPEX_NOTES: Note[] = [
  ["CapEx = compras de imobilizado (caixa), por ano fiscal de cada empresa. Microsoft exclui arrendamentos financeiros (incluindo-os, o total do FY2025 é bem maior, ~US$ 88 bi)."],
  [h("b", {}, "Nvidia é fabless"), ": não possui fábricas — quem carrega o CapEx pesado de manufatura são a TSMC (wafers e empacotamento CoWoS) e SK Hynix/Samsung/Micron (memória HBM). Esse custo entra no CMV/estoque, não no CapEx. Por isso o CapEx próprio da Nvidia (escritórios, laboratórios de P&D, servidores internos/DGX Cloud) é minúsculo: FY2025 US$ 3,2 bi e FY2026 (enc. jan/2026) US$ 6,0 bi — quase o dobro, mas ~3% da receita, contra 15–25% nos hyperscalers."],
  [h("b", {}, "O investimento econômico real da Nvidia é bem maior"), " do que a linha de CapEx sugere: prépagamentos e compromissos de compra à TSMC (dezenas de bilhões, contabilizados como estoque/compromissos), arrendamentos de capacidade (DGX Cloud, ~US$ 2,9 bi em ativos de lease) e participações estratégicas (ex.: ~US$ 13 bi ligados à Groq, além de CoreWeave) — nenhum entra no CapEx. Obs.: o ano fiscal da Nvidia é ~11 meses adiantado; a coluna FY2025 do gráfico é o exercício encerrado em jan/2025."],
  [h("b", {}, "Do outro lado:"), " o CapEx dos hyperscalers é, em boa parte, a receita da Nvidia. Amazon US$ 132 bi (FY2025), Alphabet US$ 91 bi, Meta US$ 70 bi, Microsoft US$ 55 bi (caixa). Guidance de 2026 é ainda maior: Amazon ~US$ 200 bi, Alphabet US$ 175–185 bi, Microsoft ~US$ 190 bi, Meta US$ 115–135 bi."],
];

export const CAPEX_INT_NOTES: Note[] = [
  ["CapEx ÷ receita (FY2025). Mede a intensidade de capital: Meta (~35%), Alphabet (~23%) e Microsoft/Amazon (~19%) reinvestem pesado em data centers de IA; Nvidia (~2%) e Apple (~3%) são leves em capital (modelo fabless / manufatura terceirizada)."],
];

export const CAPEX_OCF_NOTES: Note[] = [
  ["Fluxo de caixa operacional aproximado como ", h("b", {}, "FCF + CapEx"), " (FY2025). Acima de ~80% (vermelho) o CapEx absorve quase todo o caixa operacional: o crescimento passa a depender de dívida, caixa acumulado ou queda do investimento — a ponte entre a tese de IA e o risco de crédito/CDS. Arrendamentos financeiros ficam fora do CapEx (ver nota acima)."],
];

export const PD_NOTES: Note[] = [
  [h("b", {}, "PD 5a implícita"), " ≈ 1 − exp(−5·s/(1−R)), com recuperação R = 40% e taxa de risco constante. É uma leitura ", h("b", {}, "neutra ao risco"), ": inclui prêmio de risco e liquidez, então tende a ", h("b", {}, "superestimar"), " a probabilidade real de default. Use para comparar empresas, não como previsão."],
];

export const TREND_NOTE: Note = ["Cada ponto é a cotação vigente naquele dia; um ponto que não muda indica ", h("b", {}, "ausência de cotação nova"), ", não estabilidade do crédito (ver data da cotação na tabela de ratings)."];

/** Legendas do período (texto editorial do painel atual; revisar quando o trimestre de referência mudar). */
export const PERIOD_CAPTION = {
  annual: "Último ano fiscal rotulado como 2025 por cada empresa.",
  quarter: "Trimestre-calendário Abr–Jun 2026, alinhado entre as empresas.",
} as const;

export const TABLE_NOTE: Note = ["Valores GAAP salvo indicação. Tesla 2T 2026: LPA ajustado (non-GAAP) US$ 0,33."];
