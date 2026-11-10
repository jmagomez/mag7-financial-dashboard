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
