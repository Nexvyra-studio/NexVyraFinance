import {
  addMonths,
  currentMonth,
  dateInMonth,
  monthOf,
  monthsBetween,
  todayISO,
} from "./dates";
import type {
  CreditCard,
  Entry,
  FinanceData,
  ID,
  Invoice,
  Recurrence,
} from "./types";

/* ============================ cartões / faturas ============================ */

/** data de fechamento da fatura que vence em `invoiceMonth` */
export function closingDateFor(card: Pick<CreditCard, "closingDay" | "dueDay">, invoiceMonth: string) {
  const closeMonth = card.closingDay < card.dueDay ? invoiceMonth : addMonths(invoiceMonth, -1);
  return dateInMonth(closeMonth, card.closingDay);
}

export function dueDateFor(card: Pick<CreditCard, "dueDay">, invoiceMonth: string) {
  return dateInMonth(invoiceMonth, card.dueDay);
}

/** Em qual fatura (mês de vencimento) cai uma compra feita em `date` */
export function invoiceMonthFor(card: Pick<CreditCard, "closingDay" | "dueDay">, date: string) {
  let m = addMonths(monthOf(date), -1);
  for (let i = 0; i < 4; i++) {
    if (date < closingDateFor(card, m)) return m;
    m = addMonths(m, 1);
  }
  return m;
}

/** Fatura "da vez": a que ainda está aberta hoje */
export function currentInvoiceMonth(card: CreditCard) {
  return invoiceMonthFor(card, todayISO());
}

export const invoiceId = (cardId: ID, month: string) => `${cardId}_${month}`;

/* ============================ fixos mensais ============================ */

function occurrenceForMonth(r: Recurrence, month: string, cards: CreditCard[]): Entry {
  const date = dateInMonth(month, r.dayOfMonth);
  const card = r.cardId ? cards.find((c) => c.id === r.cardId) : undefined;
  return {
    id: `v:${r.id}:${month}`,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    type: r.type,
    description: r.description,
    amount: r.amount,
    date,
    categoryId: r.categoryId,
    accountId: card ? null : r.accountId,
    toAccountId: null,
    cardId: card ? card.id : null,
    invoiceMonth: card ? invoiceMonthFor(card, date) : null,
    paid: !!card,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    recurrenceId: r.id,
    notes: "",
    virtual: true,
  };
}

/**
 * Todos os lançamentos reais + previstos (fixos mensais ainda não confirmados)
 * até o mês `untilMonth` (inclusive).
 */
export function buildEntries(data: FinanceData, untilMonth: string): Entry[] {
  const materialized = new Set<string>();
  for (const t of data.transactions) {
    if (t.recurrenceId) materialized.add(`${t.recurrenceId}:${monthOf(t.date)}`);
  }
  const virtuals: Entry[] = [];
  for (const r of data.recurrences) {
    if (!r.active) continue;
    const last = r.endMonth && r.endMonth < untilMonth ? r.endMonth : untilMonth;
    for (const m of monthsBetween(r.startMonth, last)) {
      if (r.skippedMonths?.includes(m)) continue;
      if (materialized.has(`${r.id}:${m}`)) continue;
      virtuals.push(occurrenceForMonth(r, m, data.cards));
    }
  }
  return [...data.transactions, ...virtuals];
}

/** valor com sinal do ponto de vista da fatura (compras somam, estornos subtraem) */
const invoiceSigned = (e: Entry) => (e.type === "income" ? -e.amount : e.amount);

export type InvoiceStatus = "futura" | "aberta" | "fechada" | "vencida" | "paga" | "vazia";

export interface InvoiceInfo {
  cardId: ID;
  month: string;
  items: Entry[];
  total: number;
  closingDate: string;
  dueDate: string;
  status: InvoiceStatus;
  record?: Invoice;
  /** valor que falta pagar (0 se paga) */
  pending: number;
}

export function invoiceInfo(
  card: CreditCard,
  month: string,
  entries: Entry[],
  invoices: Invoice[],
): InvoiceInfo {
  const items = entries
    .filter((e) => e.cardId === card.id && e.invoiceMonth === month)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = items.reduce((s, e) => s + invoiceSigned(e), 0);
  const record = invoices.find((i) => i.cardId === card.id && i.month === month);
  const closingDate = closingDateFor(card, month);
  const dueDate = dueDateFor(card, month);
  const today = todayISO();
  let status: InvoiceStatus;
  if (record?.paid) status = "paga";
  else if (today < closingDate) status = month > currentInvoiceMonth(card) ? "futura" : "aberta";
  else if (total <= 0) status = "vazia";
  else if (today <= dueDate) status = "fechada";
  else status = "vencida";
  const pending = record?.paid || total <= 0 ? 0 : total;
  return { cardId: card.id, month, items, total, closingDate, dueDate, status, record, pending };
}

/** meses com algum lançamento no cartão (para listar faturas) */
export function invoiceMonthsOf(cardId: ID, entries: Entry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) if (e.cardId === cardId && e.invoiceMonth) set.add(e.invoiceMonth);
  return [...set].sort();
}

/** limite usado = tudo que está no cartão e ainda não foi pago (inclui parcelas futuras) */
export function cardUsage(card: CreditCard, data: FinanceData, entries: Entry[]) {
  const nowInvoice = currentInvoiceMonth(card);
  let used = 0;
  for (const m of invoiceMonthsOf(card.id, entries)) {
    const paid = data.invoices.some((i) => i.cardId === card.id && i.month === m && i.paid);
    if (paid) continue;
    used += entries
      .filter((e) => e.cardId === card.id && e.invoiceMonth === m && (!e.virtual || m <= nowInvoice))
      .reduce((s, e) => s + invoiceSigned(e), 0);
  }
  used = Math.max(0, used);
  return { used, available: card.limit - used, pct: card.limit > 0 ? Math.min(1, used / card.limit) : 0 };
}

/* ================================ contas ================================ */

export function accountBalance(data: FinanceData, accountId: ID): number {
  const acc = data.accounts.find((a) => a.id === accountId);
  let bal = acc?.initialBalance ?? 0;
  for (const t of data.transactions) {
    if (!t.paid || t.cardId) continue;
    if (t.type === "income" && t.accountId === accountId) bal += t.amount;
    else if (t.type === "expense" && t.accountId === accountId) bal -= t.amount;
    else if (t.type === "transfer") {
      if (t.accountId === accountId) bal -= t.amount;
      if (t.toAccountId === accountId) bal += t.amount;
    }
  }
  for (const inv of data.invoices) {
    if (inv.paid && inv.accountId === accountId) bal -= inv.paidAmount;
  }
  return bal;
}

export function totalBalance(data: FinanceData): number {
  return data.accounts
    .filter((a) => !a.archived)
    .reduce((s, a) => s + accountBalance(data, a.id), 0);
}

/* =============================== projeção =============================== */

export interface ProjectionRow {
  month: string;
  start: number;
  income: number;
  expense: number;
  invoices: number;
  end: number;
}

/**
 * Saldo previsto mês a mês: parte do saldo atual e soma tudo o que está pendente
 * (receitas a receber, contas a pagar, fixos previstos e faturas em aberto).
 * Pendências atrasadas entram no mês atual.
 */
export function projection(data: FinanceData, months = 12): ProjectionRow[] {
  const cur = currentMonth();
  const until = addMonths(cur, months - 1);
  const entries = buildEntries(data, until);
  const archived = new Set(data.accounts.filter((a) => a.archived).map((a) => a.id));

  const bucket = (m: string) => (m < cur ? cur : m);
  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  const invoices = new Map<string, number>();
  const add = (map: Map<string, number>, m: string, v: number) => map.set(m, (map.get(m) ?? 0) + v);

  for (const e of entries) {
    if (e.paid || e.cardId || e.type === "transfer") continue;
    if (e.accountId && archived.has(e.accountId)) continue;
    const m = bucket(monthOf(e.date));
    if (m > until) continue;
    add(e.type === "income" ? income : expense, m, e.amount);
  }

  for (const card of data.cards) {
    for (const m of invoiceMonthsOf(card.id, entries)) {
      if (m > until) continue;
      const info = invoiceInfo(card, m, entries, data.invoices);
      if (info.pending > 0) add(invoices, bucket(m), info.pending);
    }
  }

  let balance = totalBalance(data);
  return monthsBetween(cur, until).map((m) => {
    const row: ProjectionRow = {
      month: m,
      start: balance,
      income: income.get(m) ?? 0,
      expense: expense.get(m) ?? 0,
      invoices: invoices.get(m) ?? 0,
      end: 0,
    };
    row.end = row.start + row.income - row.expense - row.invoices;
    balance = row.end;
    return row;
  });
}

/* ========================== próximos vencimentos ========================== */

export interface UpcomingItem {
  key: string;
  kind: "entry" | "invoice";
  date: string;
  label: string;
  amount: number;
  type: "income" | "expense";
  entry?: Entry;
  invoice?: InvoiceInfo;
  card?: CreditCard;
}

export function upcoming(data: FinanceData, untilDate: string): UpcomingItem[] {
  const entries = buildEntries(data, addMonths(currentMonth(), 2));
  const items: UpcomingItem[] = [];
  for (const e of entries) {
    if (e.paid || e.cardId || e.type === "transfer" || e.date > untilDate) continue;
    items.push({
      key: e.id,
      kind: "entry",
      date: e.date,
      label: e.description,
      amount: e.amount,
      type: e.type as "income" | "expense",
      entry: e,
    });
  }
  for (const card of data.cards.filter((c) => !c.archived)) {
    for (const m of invoiceMonthsOf(card.id, entries)) {
      const info = invoiceInfo(card, m, entries, data.invoices);
      if (info.pending <= 0 || info.dueDate > untilDate) continue;
      items.push({
        key: `inv:${card.id}:${m}`,
        kind: "invoice",
        date: info.dueDate,
        label: `Fatura ${card.name}`,
        amount: info.pending,
        type: "expense",
        invoice: info,
        card,
      });
    }
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ======================== resumo por mês / categoria ======================= */

export function monthSummary(entries: Entry[], month: string) {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (monthOf(e.date) !== month || e.type === "transfer") continue;
    if (e.type === "income") income += e.amount;
    else expense += e.amount;
  }
  return { income, expense, net: income - expense };
}

export function spendingByCategory(entries: Entry[], month: string) {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== "expense" || monthOf(e.date) !== month) continue;
    const k = e.categoryId ?? "none";
    map.set(k, (map.get(k) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
}
