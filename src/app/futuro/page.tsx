"use client";

import { ArrowDownLeft, ArrowUpRight, CreditCard, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { EntryRow } from "@/components/entry-row";
import { Card, Money, SectionTitle, Segmented, cx } from "@/components/ui";
import { addMonths, currentMonth, monthLabel, monthOf, monthShort, monthShortYear } from "@/lib/dates";
import { buildEntries, invoiceInfo, invoiceMonthsOf, projection, totalBalance } from "@/lib/finance";
import { formatBRLCompact } from "@/lib/money";
import { useFinance } from "@/store/finance-store";

export default function FuturoPage() {
  const { data } = useFinance();
  const [range, setRange] = useState<"6" | "12">("6");
  const [selected, setSelected] = useState(currentMonth());
  const months = Number(range);

  const { rows, balance, entries } = useMemo(
    () => ({
      rows: projection(data, months),
      balance: totalBalance(data),
      entries: buildEntries(data, addMonths(currentMonth(), months - 1)),
    }),
    [data, months],
  );

  const sel = rows.find((r) => r.month === selected) ?? rows[0];
  const last = rows[rows.length - 1];
  const firstNegative = rows.find((r) => r.end < 0);

  const detail = useMemo(() => {
    const cur = currentMonth();
    const inMonth = (m: string) => (m < cur ? cur : m) === sel.month;
    const pendings = entries
      .filter((e) => !e.paid && !e.cardId && e.type !== "transfer" && inMonth(monthOf(e.date)))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const invoices = data.cards.flatMap((c) =>
      invoiceMonthsOf(c.id, entries)
        .filter(inMonth)
        .map((m) => ({ card: c, info: invoiceInfo(c, m, entries, data.invoices) }))
        .filter((x) => x.info.pending > 0),
    );
    return { pendings, invoices };
  }, [entries, data, sel]);

  // gráfico
  const values = rows.map((r) => r.end);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const zeroPct = (max / span) * 100;

  return (
    <>
      <PageHeader title="Futuro" subtitle="Quanto você vai ter" />

      <section className="mt-3 rounded-[28px] border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-muted">Saldo hoje</p>
            <Money value={balance} className="text-2xl font-extrabold" />
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-muted">Em {monthLabel(last.month, false).toLowerCase()}</p>
            <Money value={last.end} className={cx("text-2xl font-extrabold", last.end < 0 ? "text-expense" : "text-accent-text")} />
          </div>
        </div>

        {firstNegative && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-expense/10 px-3 py-2.5 text-sm font-medium text-expense">
            <TriangleAlert size={18} className="shrink-0" />
            Saldo fica negativo em {monthLabel(firstNegative.month).toLowerCase()}.
          </div>
        )}

        <Segmented
          className="mt-4"
          value={range}
          onChange={(v) => { setRange(v); setSelected(currentMonth()); }}
          options={[{ value: "6", label: "6 meses" }, { value: "12", label: "12 meses" }]}
        />

        {/* barras do saldo final previsto de cada mês */}
        <div className="relative mt-5 h-48" role="img" aria-label="Saldo previsto ao fim de cada mês">
          <div className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${zeroPct}%` }} />
          <div className="absolute inset-0 flex gap-1.5">
            {rows.map((r) => {
              const h = (Math.abs(r.end) / span) * 100;
              const active = r.month === sel.month;
              const neg = r.end < 0;
              return (
                <button
                  key={r.month}
                  type="button"
                  onClick={() => setSelected(r.month)}
                  className="relative h-full flex-1"
                  aria-label={`${monthLabel(r.month)}: ${formatBRLCompact(r.end)}`}
                >
                  <span
                    className={cx("absolute inset-x-0.5 transition", neg ? "rounded-b-[4px]" : "rounded-t-[4px]")}
                    style={{
                      top: neg ? `${zeroPct}%` : `${zeroPct - h}%`,
                      height: `${Math.max(h, 1)}%`,
                      background: neg ? "var(--expense)" : active ? "var(--accent)" : "var(--surface-3)",
                      opacity: neg && !active ? 0.55 : 1,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          {rows.map((r) => (
            <span key={r.month} className={cx("flex-1 text-center text-[10px] font-semibold capitalize", r.month === sel.month ? "text-fg" : "text-faint")}>
              {monthShort(r.month)}
            </span>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <div>
          <SectionTitle>{monthLabel(sel.month)}</SectionTitle>
          <Card>
            <Line label="Começa com" value={sel.start} />
            <Line label="Entradas a receber" value={sel.income} sign="income" icon={<ArrowDownLeft size={16} className="text-income" />} />
            <Line label="Contas a pagar" value={sel.expense} sign="expense" icon={<ArrowUpRight size={16} className="text-expense" />} />
            <Line label="Faturas de cartão" value={sel.invoices} sign="expense" icon={<CreditCard size={16} className="text-muted" />} />
            <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
              <span className="font-semibold">Termina com</span>
              <Money value={sel.end} className={cx("text-xl font-extrabold", sel.end < 0 && "text-expense")} />
            </div>
          </Card>

          <SectionTitle>Mês a mês</SectionTitle>
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2.5 font-semibold">Mês</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Resultado</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const net = r.income - r.expense - r.invoices;
                  return (
                    <tr
                      key={r.month}
                      onClick={() => setSelected(r.month)}
                      className={cx("cursor-pointer border-t border-line transition", r.month === sel.month ? "bg-surface-2" : "hover:bg-surface-2/50")}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{monthShortYear(r.month)}</td>
                      <td className={cx("px-2 py-3 text-right", net < 0 ? "text-expense" : "text-income")}>
                        <Money value={net} sign={net === 0 ? undefined : "auto"} />
                      </td>
                      <td className={cx("px-4 py-3 text-right font-bold", r.end < 0 && "text-expense")}>
                        <Money value={r.end} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        <div>
          <SectionTitle>O que entra no cálculo</SectionTitle>
          <Card className="p-1.5">
            {detail.invoices.length === 0 && detail.pendings.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">Nada pendente neste mês.</p>
            )}
            {detail.invoices.map(({ card, info }) => (
              <div key={card.id + info.month} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${card.color}22`, color: card.color }}>
                  <CreditCard size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">Fatura {card.name}</span>
                  <span className="block text-xs text-muted">{monthLabel(info.month)} · {info.items.length} itens</span>
                </span>
                <Money value={info.pending} sign="expense" className="text-[15px] font-bold" />
              </div>
            ))}
            {detail.pendings.map((e) => (
              <EntryRow key={e.id} entry={e} showDate />
            ))}
          </Card>
          <p className="mt-3 px-2 text-xs leading-relaxed text-faint">
            A previsão parte do saldo atual das contas e soma tudo que ainda está pendente: receitas a receber,
            contas a pagar, fixos mensais e faturas em aberto. Pendências atrasadas entram no mês atual.
          </p>
        </div>
      </div>
    </>
  );
}

function Line({ label, value, sign, icon }: { label: string; value: number; sign?: "income" | "expense"; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-sm text-muted">
        {icon}
        {label}
      </span>
      <Money value={value} sign={value ? sign : undefined} colored={sign === "income"} className="font-semibold" />
    </div>
  );
}
