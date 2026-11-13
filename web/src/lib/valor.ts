/**
 * Leitor dos campos escalares de `derived` (Fase 3): cada empresa é `{ value, asOf, tier, source }` e a saída traz só o
 * número de cada uma, que é o que o resto do painel usa. Número solto (formato antigo) é erro, como em src/common.py::unwrap_derived.
 */
import type { Derived } from "../types.ts";

/** Blocos com um número por empresa (mesma lista de SCALAR_DERIVED em src/common.py). */
export const SCALAR_DERIVED = ["fcfTTM", "fwdPE", "ebitdaImplB", "fwdEPS", "oneOffTTM"] as const;

/** Número de um campo v2: o `value` do objeto; qualquer outra coisa (inclusive número solto) → undefined. */
export function valueOf(x: unknown): number | undefined {
  const v = typeof x === "object" && x !== null && !Array.isArray(x) ? (x as { value?: unknown }).value : undefined;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function unwrapDerived(d: Derived): Derived {
  const out: Record<string, unknown> = { ...d };
  for (const blk of SCALAR_DERIVED) {
    const raw = (d as unknown as Record<string, unknown>)[blk];
    if (typeof raw !== "object" || raw === null) continue;
    const soltos = Object.entries(raw).filter(([, v]) => typeof v !== "object" || v === null).map(([t]) => t);
    if (soltos.length) throw new Error(`derived.${blk}: número solto em ${soltos.join(", ")}; use {value, asOf, tier, source}`);
    out[blk] = Object.fromEntries(Object.entries(raw).flatMap(([t, v]) => {
      const n = valueOf(v);
      return n === undefined ? [] : [[t, n]];
    }));
  }
  return out as unknown as Derived;
}
