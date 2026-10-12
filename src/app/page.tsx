"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronRight, CreditCard, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { EntryRow } from "@/components/entry-row";
import { PageHeader } from "@/components/app-shell";
import { useSheets } from "@/components/sheets";
import { InvoiceBadge } from "@/components/invoice-badge";
import { Button, Card, Empty, Money, Progress, SectionTitle, cx } from "@/components/ui";
import { addDays, addMonths, currentMonth, dayLabel, monthLabel, todayISO } from "@/lib/dates";
import {
  accountBalance,
  buildEntries,
  cardUsage,
  currentInvoiceMonth,
  invoiceInfo,
  monthSummary,
  projection,
  spendingByCategory,
  totalBalance,
  upcoming,
} from "@/lib/finance";
import { useFinance, useLookups } from "@/store/finance-store";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function HomePage() {
  const { data } = useFinance();
  const lk = useLookups();
  const { openNew } = useSheets();
  const month = currentMonth();

  const view = useMemo(() => {
    const entries = buildEntries(data, addMonths(month, 12));
    const proj = projection(data, 3);
    return {
      entries,
      balance: totalBalance(data),
      proj,
      summary: monthSummary(entries, month),
      byCategory: spendingByCategory(entries, month),
      next: upcoming(data, addDays(todayISO(), 15)),
      recent: [...data.transactions]
        .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1))
        .filter((t) => t.date <= todayISO())
        .slice(0, 5),
    };
  }, [data, month]);

  const accounts = data.accounts.filter((a) => !a.archived);
  const cards = data.cards.filter((c) => !c.archived);
  const endOfMonth = view.proj[0]?.end ?? view.balance;
  const in3 = view.proj[2]?.end ?? endOfMonth;
  const maxCat = view.byCategory[0]?.total ?? 1;

  return (
    <>
      <PageHeader subtitle={greeting()} title="Seu dinheiro" />

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-[1.15fr_1fr]">
        <div>
          {/* saldo */}
          <section className="relative mt-3 overflow-hidden rounded-[28px] border border-line bg-surface p-5">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/15 blur-3xl" />
            <p className="text-sm font-semibold text-muted">Saldo em contas</p>
            <Money value={view.balance} className="mt-1 block text-[38px] font-extrabold leading-tight" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link href="/futuro" className="rounded-2xl bg-surface-2 p-3 transition hover:bg-surface-3">
                <p className="text-xs font-semibold text-muted">Previsto fim do mês</p>
                <Money value={endOfMonth} className={cx("mt-0.5 block text-lg font-bold", endOfMonth < 0 && "text-expense")} />
              </Link>
              <Link href="/futuro" className="rounded-2xl bg-surface-2 p-3 transition hover:bg-surface-3">
                <p className="text-xs font-semibold text-muted">Em {monthLabel(view.proj[2]?.month ?? month, false).toLowerCase()}</p>
                <Money value={in3} className={cx("mt-0.5 block text-lg font-bold", in3 < 0 && "text-expense")} />
              </Link>
            </div>
            <div className="mt-3 flex gap-4 px-1 text-sm">
              <span className="flex items-center gap-1.5 text-muted">
                <ArrowDownLeft size={16} className="text-income" /> Entradas{" "}
                <Money value={view.summary.income} className="font-semibold text-fg" />
              </span>
              <span className="flex items-center gap-1.5 text-muted">
                <ArrowUpRight size={16} className="text-expense" /> Saídas{" "}
                <Money value={view.summary.expense} className="font-semibold text-fg" />
              </span>
            </div>
          </section>

          {/* contas */}
          <SectionTitle action={<Link href="/ajustes#contas" className="text-xs font-semibold text-accent-text">Gerenciar</Link>}>
            Contas
          </SectionTitle>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:px-0">
            {accounts.map((a) => (
              <div key={a.id} className="min-w-[46%] snap-start rounded-3xl border border-line bg-surface p-4 md:min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl" style={{ background: `${a.color}22`, color: a.color }}>
                    <Wallet size={16} />
                  </span>
                  <span className="truncate text-sm font-semibold">{a.name}</span>
                </div>
                <Money value={accountBalance(data, a.id)} className="mt-3 block text-lg font-bold" />
              </div>
            ))}
          </div>

          {/* cartões */}
          <SectionTitle action={<Link href="/cartoes" className="text-xs font-semibold text-accent-text">Ver faturas</Link>}>
            Cartões
          </SectionTitle>
          {cards.length === 0 ? (
            <Card>
              <Empty icon={<CreditCard />} title="Nenhum cartão" text="Cadastre seus cartões para controlar faturas e limite." action={<Link href="/cartoes"><Button size="sm">Adicionar cartão</Button></Link>} />
            </Card>
          ) : (
            <div className="space-y-2">
              {cards.map((c) => {
                const m = currentInvoiceMonth(c);
                const inv = invoiceInfo(c, m, view.entries, data.invoices);
                const usage = cardUsage(c, data, view.entries);
                return (
                  <Link key={c.id} href={`/cartoes#${c.id}`} className="block rounded-3xl border border-line bg-surface p-4 transition hover:bg-surface-2/50">
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-12 shrink-0 rounded-lg" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}88)` }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="text-xs text-muted">Fatura de {monthLabel(m, false).toLowerCase()} · vence {dayLabel(inv.dueDate).toLowerCase()}</p>
                      </div>
                      <div className="text-right">
                        <Money value={inv.total} className="block font-bold" />
                        <InvoiceBadge status={inv.status} />
                      </div>
                    </div>
                    <Progress value={usage.pct} color={c.color} className="mt-3 h-1.5" />
                    <p className="mt-1.5 flex justify-between text-[11px] text-muted">
                      <span>Usado <Money value={usage.used} /></span>
                      <span>Disponível <Money value={usage.available} /></span>
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div>
          {/* próximos */}
          <SectionTitle>Próximos 15 dias</SectionTitle>
          <Card className="p-2">
            {view.next.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">Nada pendente nos próximos dias 🎉</p>
            ) : (
              view.next.slice(0, 8).map((item) =>
                item.kind === "entry" && item.entry ? (
                  <EntryRow key={item.key} entry={item.entry} showDate />
                ) : (
                  <Link key={item.key} href={`/cartoes#${item.card!.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface-2/60">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${item.card!.color}22`, color: item.card!.color }}>
                      <CreditCard size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{item.label}</span>
                      <span className="block text-xs text-muted">vence {dayLabel(item.date).toLowerCase()}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Money value={item.amount} sign="expense" className="text-[15px] font-bold" />
                      <InvoiceBadge status={item.invoice!.status} />
                    </span>
                    <ChevronRight size={16} className="text-faint" />
                  </Link>
                ),
              )
            )}
          </Card>

          {/* categorias */}
          <SectionTitle action={<span className="text-xs text-muted">{monthLabel(month)}</span>}>Gastos por categoria</SectionTitle>
          <Card>
            {view.byCategory.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Sem gastos neste mês ainda.</p>
            ) : (
              <ul className="space-y-3">
                {view.byCategory.slice(0, 6).map(({ categoryId, total }) => {
                  const c = lk.category(categoryId);
                  const pct = view.summary.expense ? total / view.summary.expense : 0;
                  return (
                    <li key={categoryId} className="flex items-center gap-3">
                      <CategoryIcon icon={c?.icon} color={c?.color} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-semibold">{c?.name ?? "Sem categoria"}</span>
                          <span className="shrink-0">
                            <Money value={total} className="font-semibold" />
                            <span className="ml-1.5 text-xs text-muted">{Math.round(pct * 100)}%</span>
                          </span>
                        </div>
                        <Progress value={total / maxCat} color={c?.color ?? "var(--faint)"} className="mt-1.5 h-1.5" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* recentes */}
          <SectionTitle action={<Link href="/lancamentos" className="text-xs font-semibold text-accent-text">Ver todos</Link>}>
            Últimos lançamentos
          </SectionTitle>
          <Card className="p-2">
            {view.recent.length === 0 ? (
              <Empty title="Nenhum lançamento" text="Toque no + para registrar o primeiro." action={<Button size="sm" onClick={() => openNew()}>Novo lançamento</Button>} />
            ) : (
              view.recent.map((t) => <EntryRow key={t.id} entry={t} showDate />)
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
