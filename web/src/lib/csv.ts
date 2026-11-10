/**
 * CSV (RFC 4180) com BOM UTF-8 para abrir bem no Excel. Número só vira texto se finito; null/undefined/NaN viram célula vazia.
 * Texto que começa com = + - @ (ou tab/CR) recebe um apóstrofo na frente: sem isso o Excel o trataria como fórmula.
 */
export type Cell = string | number | null | undefined;

export function csvCell(c: Cell): string {
  if (c === null || c === undefined) return "";
  if (typeof c === "number") return Number.isFinite(c) ? String(c) : "";
  const safe = /^[=+\-@\t\r]/.test(c) ? `'${c}` : c;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return `﻿${rows.map((r) => r.map(csvCell).join(",")).join("\n")}`;
}
