const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** centavos -> "R$ 1.234,56" */
export function formatBRL(cents: number): string {
  return brl.format((cents || 0) / 100);
}

export function formatBRLCompact(cents: number): string {
  if (Math.abs(cents) < 100000) return formatBRL(cents);
  return brlCompact.format(cents / 100);
}

/** "1.234,56" | "1234.56" | "1234" -> centavos */
export function parseBRL(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** divide um total em N parcelas inteiras; a diferença de centavos vai na primeira */
export function splitInstallments(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + rest : base));
}
