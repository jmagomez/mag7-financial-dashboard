/**
 * Leitor duplo dos campos de `derived` (Fase 3, passo 1): aceita o número simples (formato atual) ou
 * `{ value, asOf, tier, source }` (formato v2) e devolve sempre o formato antigo. Espelha src/common.py::unwrap_derived.
 * Sem campos v2 a saída tem os mesmos valores da entrada: nenhuma mudança visível.
 */
import type { Derived } from "../types.ts";

/** Blocos com um número por empresa (mesma lista de SCALAR_DERIVED em src/common.py). */
export const SCALAR_DERIVED = ["fcfTTM", "fwdPE", "ebitdaImplB", "fwdEPS", "oneOffTTM"] as const;

/** Número de um campo: o próprio número ou o `value` de um objeto v2; qualquer outra coisa → undefined. */
export function valueOf(x: unknown): number | undefined {
  const v = typeof x === "object" && x !== null && !Array.isArray(x) ? (x as { value?: unknown }).value : x;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function unwrapDerived(d: Derived): Derived {
  const out: Record<string, unknown> = { ...d };
  for (const blk of SCALAR_DERIVED) {
    const raw = (d as unknown as Record<string, unknown>)[blk];
    if (typeof raw !== "object" || raw === null) continue;
    out[blk] = Object.fromEntries(Object.entries(raw).flatMap(([t, v]) => {
      const n = valueOf(v);
      return n === undefined ? [] : [[t, n]];
    }));
  }
  return out as unknown as Derived;
}
