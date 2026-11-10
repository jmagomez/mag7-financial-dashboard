/** Escape e validação de dados externos. Todo texto/URL que vem de data.json passa por aqui ou por `vdom.ts`. */
const MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (ch) => MAP[ch] ?? ch);

/** Devolve a URL normalizada só se for `https:`; qualquer outra coisa (javascript:, data:, http:, relativa) vira null. */
export function safeHttpsUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  try {
    const p = new URL(u);
    return p.protocol === "https:" ? p.href : null;
  } catch {
    return null;
  }
}
