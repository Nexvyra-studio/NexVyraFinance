import { Badge } from "./ui";

export function InvoiceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: "muted" | "income" | "expense" | "warn" | "accent" }> = {
    aberta: { label: "aberta", tone: "accent" },
    fechada: { label: "fechada", tone: "warn" },
    vencida: { label: "vencida", tone: "expense" },
    paga: { label: "paga", tone: "income" },
    futura: { label: "futura", tone: "muted" },
    vazia: { label: "sem gastos", tone: "muted" },
  };
  const s = map[status] ?? map.futura;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
