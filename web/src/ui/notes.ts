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

/** Texto editorial do 2T'26 portado do painel atual; os números de lucro (operacional → líquido) são conferidos contra `fundamentals.json` em `valuation.test.ts`. Revisar a cada trimestre. */
export const VAL_NOTES: Note[] = [
  [h("b", {}, "A leitura decisiva de qualidade do lucro."), " Quando o lucro líquido e o operacional (GAAP, trimestre) são próximos, o líquido reflete a operação. Quando o ", h("b", {}, "líquido"), " supera muito o ", h("b", {}, "operacional"), ", o excesso é NÃO operacional — tipicamente ganhos não realizados (mark-to-market) com participações, sem caixa; nesses casos o P/E e a margem GAAP do trimestre enganam."],
  [h("b", {}, "As armadilhas do 2T'26:"), " ", h("b", {}, "Alphabet"), " reportou US$ 112,1 bi de lucro líquido sobre apenas US$ 40,8 bi operacional (~2,7x) — ~US$ 77 bi vêm de ganho não realizado com participações; ", h("b", {}, "Amazon"), ", US$ 62,6 bi líquido vs US$ 27,5 bi operacional, com ~US$ 53 bi de ganho com a Anthropic. Nesses dois, o P/E e a margem GAAP do trimestre são enganosos — use o operacional."],
  [h("b", {}, "O outro lado:"), " em ", h("b", {}, "Apple"), " (op 35,7 → líq 29,8), ", h("b", {}, "Microsoft"), " (40,6 → 35,8) e ", h("b", {}, "Nvidia"), " (63,7 → 59,7) o líquido é MENOR que o operacional (impostos) — lucro de alta qualidade. Ressalvas: o líquido da Nvidia ainda embute ~US$ 7,8 bi de ganhos com participações (em ‘outras receitas’) e o da Microsoft ~US$ 3,2 bi (Anthropic). ", h("b", {}, "Meta"), " (op 18,8 → líq 15,9): impostos e encargos jurídicos/rescisões. ", h("b", {}, "Tesla"), " é o caso extremo inverso: líq 1,11 > op 0,40 — quase todo o lucro veio de ~US$ 1 bi de ganho com a SpaceX, não da operação."],
  [h("b", {}, "Regra dos 40"), " = crescimento de receita (a/a) + margem de FCF (FCF ÷ receita do último ano fiscal). Acima de 40% indica equilíbrio entre crescer e gerar caixa."],
  [h("b", {}, "Caixa líquido"), " = caixa + títulos negociáveis (curto e longo prazo) menos dívida financiada (bonds/commercial paper), sem arrendamentos nem participações não negociáveis. Fonte: balanços do 2T 2026 (SEC); Tesla aproximado. Para megacaps é só ±1–4% do valor de mercado, então EV ≈ valor de mercado."],
  [h("b", {}, "Nuvem/IA e dispersão:"), " os segmentos de nuvem/IA são os divulgados nos releases do trimestre (a Microsoft não divulga o Azure isolado, então aparece Intelligent Cloud). Na dispersão, EV ≈ valor de mercado para megacaps e o crescimento é o do último ano fiscal; empresas com crescimento ou EV/EBITDA indisponível ficam fora do gráfico e aparecem só na tabela."],
  [h("b", {}, "DCF reverso:"), " crescimento de FCF em 10 anos que o EV atual embute (WACC por empresa, calculado no rodapé, e crescimento terminal 3%). É uma leitura do que o preço pressupõe, não uma projeção."],
];
