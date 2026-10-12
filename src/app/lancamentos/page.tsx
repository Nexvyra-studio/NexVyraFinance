"use client";

import { ArrowLeftRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { EntryRow } from "@/components/entry-row";
import { MonthSwitcher } from "@/components/month-switcher";
import { useSheets } from "@/components/sheets";
import { Button, Empty, IconButton, Money, cx, inputClass } from "@/components/ui";
import { currentMonth, dayLabel, monthOf } from "@/lib/dates";
import { buildEntries, monthSummary } from "@/lib/finance";
import type { Entry } from "@/lib/types";
import { useFinance, useLookups } from "@/store/finance-store";

type Filter = "all" | "income" | "expense" | "card" | "pending";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "expense", label: "Despesas" },
  { value: "income", label: "Receitas" },
  { value: "card", label: "Cartão" },
  { value: "pending", label: "Pendentes" },
];

export default function LancamentosPage() {
  const { data } = useFinance();
  const lk = useLookups();
  const { openNew } = useSheets();
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const { groups, summary, count } = useMemo(() => {
    const all = buildEntries(data, month).filter((e) => monthOf(e.date) === month);
    const q = query.trim().toLowerCase();
    const list = all.filter((e) => {
      if (filter === "income" && e.type !== "income") return false;
      if (filter === "expense" && e.type !== "expense") return false;
      if (filter === "card" && !e.cardId) return false;
      if (filter === "pending" && (e.paid || e.cardId)) return false;
      if (q) {
        const hay = `${e.description} ${lk.category(e.categoryId)?.name ?? ""} ${e.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
    const map = new Map<string, Entry[]>();
    for (const e of list) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return { groups: [...map.entries()], summary: monthSummary(all, month), count: list.length };
  }, [data, month, filter, query, lk]);

  return (
    <>
      <PageHeader
        title="Lançamentos"
        actions={
          <IconButton label="Buscar" onClick={() => { setSearching((s) => !s); setQuery(""); }}>
            {searching ? <X size={20} /> : <Search size={20} />}
          </IconButton>
        }
      />

      <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 pb-3 pt-2 backdrop-blur-xl md:mx-0 md:px-0">
        {searching && (
          <input autoFocus className={cx(inputClass, "mb-2")} placeholder="Buscar por descrição ou categoria" value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        <MonthSwitcher month={month} onChange={setMonth} className="border border-line" />
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cx(
                "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition",
                filter === f.value ? "bg-fg text-bg" : "bg-surface text-muted hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryBox label="Entradas" value={summary.income} tone="income" />
        <SummaryBox label="Saídas" value={summary.expense} tone="expense" />
        <SummaryBox label="Resultado" value={summary.net} tone={summary.net >= 0 ? "income" : "expense"} />
      </div>

      <div className="mt-4">
        {count === 0 ? (
          <Empty
            icon={<ArrowLeftRight />}
            title="Nada por aqui"
            text={query ? "Nenhum lançamento encontrado para essa busca." : "Nenhum lançamento neste mês com esse filtro."}
            action={<Button size="sm" onClick={() => openNew({ date: month === currentMonth() ? undefined : `${month}-01` })}>Novo lançamento</Button>}
          />
        ) : (
          groups.map(([date, items]) => {
            const dayNet = items.reduce((s, e) => s + (e.type === "income" ? e.amount : e.type === "expense" ? -e.amount : 0), 0);
            return (
              <section key={date} className="mb-3">
                <div className="flex items-baseline justify-between px-2 pb-1 pt-2">
                  <h3 className="text-sm font-bold capitalize">{dayLabel(date)}</h3>
                  <Money value={dayNet} sign={dayNet === 0 ? undefined : "auto"} className="text-xs font-semibold text-muted" />
                </div>
                <div className="rounded-3xl border border-line bg-surface p-1.5">
                  {items.map((e) => (
                    <EntryRow key={e.id} entry={e} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}

function SummaryBox({ label, value, tone }: { label: string; value: number; tone: "income" | "expense" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <Money value={value} className={cx("block truncate text-[15px] font-bold", tone === "income" ? "text-income" : "text-expense")} />
    </div>
  );
}
