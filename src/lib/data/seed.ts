import { addMonths, addMonthsToDate, currentMonth, dateInMonth, todayISO, addDays } from "../dates";
import { invoiceMonthFor } from "../finance";
import { splitInstallments } from "../money";
import { emptyData, type Category, type CreditCard, type FinanceData, type Transaction } from "../types";

/** id curto e único (não depende de crypto.randomUUID, que não existe em http no celular) */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const nowStamp = () => new Date().toISOString();

const base = () => {
  const t = nowStamp();
  return { createdAt: t, updatedAt: t };
};

const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Alimentação", kind: "expense", color: "#F59E6B", icon: "utensils" },
  { name: "Mercado", kind: "expense", color: "#F7C55E", icon: "cart" },
  { name: "Transporte", kind: "expense", color: "#6BB8F5", icon: "car" },
  { name: "Moradia", kind: "expense", color: "#B49BF5", icon: "home" },
  { name: "Contas", kind: "expense", color: "#5ED1E0", icon: "zap" },
  { name: "Saúde", kind: "expense", color: "#F58FA8", icon: "health" },
  { name: "Lazer", kind: "expense", color: "#8FE07A", icon: "game" },
  { name: "Compras", kind: "expense", color: "#E58FF5", icon: "bag" },
  { name: "Assinaturas", kind: "expense", color: "#7A8CF5", icon: "repeat" },
  { name: "Educação", kind: "expense", color: "#F5D76B", icon: "education" },
  { name: "Outros", kind: "expense", color: "#9AA3B2", icon: "dots" },
  { name: "Salário", kind: "income", color: "#5BD69B", icon: "briefcase" },
  { name: "Freelance", kind: "income", color: "#6BE0C8", icon: "laptop" },
  { name: "Rendimentos", kind: "income", color: "#A6E36B", icon: "trending" },
  { name: "Outras receitas", kind: "income", color: "#9AA3B2", icon: "gift" },
];

/** Dados iniciais de um usuário novo: categorias + uma conta */
export function initialData(): FinanceData {
  const data = emptyData();
  data.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: newId(), ...base() }));
  data.accounts = [
    {
      id: newId(),
      name: "Conta principal",
      type: "corrente",
      initialBalance: 0,
      color: "#D4F36B",
      archived: false,
      ...base(),
    },
  ];
  return data;
}

/** Dados de exemplo para testar o app */
export function demoData(): FinanceData {
  const data = initialData();
  const cat = (name: string) => data.categories.find((c) => c.name === name)!.id;
  const today = todayISO();
  const cur = currentMonth();
  const acc = data.accounts[0];
  acc.name = "Nubank Conta";
  acc.initialBalance = 420000;
  const acc2 = {
    ...acc,
    id: newId(),
    name: "Carteira",
    type: "carteira" as const,
    initialBalance: 18000,
    color: "#5BD69B",
  };
  data.accounts.push(acc2);

  const nubank: CreditCard = {
    id: newId(),
    name: "Nubank",
    brand: "mastercard",
    limit: 800000,
    closingDay: 3,
    dueDay: 10,
    color: "#8A5CF6",
    paymentAccountId: acc.id,
    archived: false,
    ...base(),
  };
  const inter: CreditCard = {
    id: newId(),
    name: "Inter",
    brand: "visa",
    limit: 350000,
    closingDay: 20,
    dueDay: 28,
    color: "#FF8A3D",
    paymentAccountId: acc.id,
    archived: false,
    ...base(),
  };
  data.cards.push(nubank, inter);

  const tx = (p: Partial<Transaction> & Pick<Transaction, "type" | "description" | "amount" | "date">): Transaction => ({
    id: newId(),
    categoryId: null,
    accountId: null,
    toAccountId: null,
    cardId: null,
    invoiceMonth: null,
    paid: true,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    recurrenceId: null,
    notes: "",
    ...base(),
    ...p,
  });

  const cardTx = (card: CreditCard, description: string, amount: number, date: string, category: string) =>
    tx({ type: "expense", description, amount, date, cardId: card.id, invoiceMonth: invoiceMonthFor(card, date), categoryId: cat(category) });

  const d = (offset: number) => addDays(today, offset);

  data.transactions.push(
    cardTx(nubank, "iFood", 6790, d(-1), "Alimentação"),
    cardTx(nubank, "Uber", 2340, d(-2), "Transporte"),
    cardTx(nubank, "Farmácia", 8920, d(-4), "Saúde"),
    cardTx(inter, "Posto Shell", 22000, d(-3), "Transporte"),
    cardTx(inter, "Restaurante", 14500, d(-6), "Alimentação"),
    cardTx(nubank, "Cinema", 6400, d(-9), "Lazer"),
    tx({ type: "expense", description: "Mercado Extra", amount: 38750, date: d(-2), accountId: acc.id, categoryId: cat("Mercado") }),
    tx({ type: "expense", description: "Padaria", amount: 2350, date: d(-1), accountId: acc2.id, categoryId: cat("Alimentação") }),
    tx({ type: "income", description: "Freela site", amount: 120000, date: d(-5), accountId: acc.id, categoryId: cat("Freelance") }),
    tx({ type: "expense", description: "Conta de luz", amount: 18990, date: d(4), accountId: acc.id, categoryId: cat("Contas"), paid: false }),
    tx({ type: "expense", description: "Internet", amount: 9990, date: d(8), accountId: acc.id, categoryId: cat("Contas"), paid: false }),
  );

  // compra parcelada
  const group = newId();
  const notebookDate = d(-20);
  splitInstallments(420000, 10).forEach((amount, i) => {
    const date = addMonthsToDate(notebookDate, i);
    data.transactions.push(
      tx({
        type: "expense",
        description: "Notebook",
        amount,
        date,
        cardId: nubank.id,
        invoiceMonth: addMonths(invoiceMonthFor(nubank, notebookDate), i),
        categoryId: cat("Compras"),
        installmentGroupId: group,
        installmentNumber: i + 1,
        installmentTotal: 10,
      }),
    );
  });

  // fixos mensais
  const rec = (p: Partial<FinanceData["recurrences"][number]> & { description: string; amount: number; type: "income" | "expense"; dayOfMonth: number }) => ({
    id: newId(),
    categoryId: null,
    accountId: acc.id,
    cardId: null,
    startMonth: cur,
    endMonth: null,
    skippedMonths: [],
    active: true,
    ...base(),
    ...p,
  });
  data.recurrences.push(
    rec({ type: "income", description: "Salário", amount: 650000, dayOfMonth: 5, categoryId: cat("Salário"), startMonth: addMonths(cur, 1) }),
    rec({ type: "expense", description: "Aluguel", amount: 180000, dayOfMonth: 10, categoryId: cat("Moradia"), startMonth: addMonths(cur, 1) }),
    rec({ type: "expense", description: "Spotify", amount: 2190, dayOfMonth: 15, categoryId: cat("Assinaturas"), accountId: null, cardId: nubank.id }),
    rec({ type: "expense", description: "Netflix", amount: 4490, dayOfMonth: 22, categoryId: cat("Assinaturas"), accountId: null, cardId: inter.id }),
  );

  // faturas anteriores à atual já pagas
  for (const card of data.cards) {
    const months = new Set(data.transactions.filter((t) => t.cardId === card.id && t.invoiceMonth).map((t) => t.invoiceMonth!));
    for (const m of months) {
      if (m >= invoiceMonthFor(card, today)) continue;
      const amount = data.transactions.filter((t) => t.cardId === card.id && t.invoiceMonth === m).reduce((s, t) => s + t.amount, 0);
      data.invoices.push({ id: `${card.id}_${m}`, cardId: card.id, month: m, paid: true, paidAt: nowStamp(), paidAmount: amount, accountId: acc.id, ...base() });
    }
  }

  // salário e aluguel deste mês já lançados
  data.transactions.push(
    tx({ type: "income", description: "Salário", amount: 650000, date: dateInMonth(cur, 5), accountId: acc.id, categoryId: cat("Salário") }),
    tx({ type: "expense", description: "Aluguel", amount: 180000, date: dateInMonth(cur, 10), accountId: acc.id, categoryId: cat("Moradia") }),
  );

  return data;
}
