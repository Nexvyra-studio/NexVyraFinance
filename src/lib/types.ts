/**
 * Modelo de dados do NexVyra Finance.
 *
 * Cada interface abaixo corresponde a uma coleção do Firestore em
 * `users/{uid}/{coleção}/{id}` (veja docs/FIREBASE.md).
 *
 * Convenções:
 *  - Valores monetários são SEMPRE inteiros em centavos (R$ 12,34 => 1234).
 *  - Datas são strings ISO locais: "YYYY-MM-DD".
 *  - Meses são strings "YYYY-MM".
 *  - createdAt/updatedAt são ISO timestamps completos.
 */

export type ID = string;

export interface BaseDoc {
  id: ID;
  createdAt: string;
  updatedAt: string;
}

/* ----------------------------- accounts ----------------------------- */

export type AccountType = "corrente" | "poupanca" | "carteira" | "investimento";

export interface Account extends BaseDoc {
  name: string;
  type: AccountType;
  /** saldo inicial em centavos (o saldo no dia em que você começou a usar o app) */
  initialBalance: number;
  color: string;
  archived: boolean;
}

/* ------------------------------- cards ------------------------------ */

export type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "outro";

export interface CreditCard extends BaseDoc {
  name: string;
  brand: CardBrand;
  /** limite total em centavos */
  limit: number;
  /** dia do mês em que a fatura fecha (compras a partir desse dia vão para a próxima) */
  closingDay: number;
  /** dia do mês em que a fatura vence */
  dueDay: number;
  color: string;
  /** conta padrão usada para pagar a fatura */
  paymentAccountId: ID | null;
  archived: boolean;
}

/* ---------------------------- categories ---------------------------- */

export type CategoryKind = "income" | "expense";

export interface Category extends BaseDoc {
  name: string;
  kind: CategoryKind;
  color: string;
  /** nome do ícone (ver src/components/category-icon.tsx) */
  icon: string;
}

/* --------------------------- transactions --------------------------- */

export type TransactionType = "income" | "expense" | "transfer";

export interface Transaction extends BaseDoc {
  type: TransactionType;
  description: string;
  /** valor positivo em centavos */
  amount: number;
  /** data da compra / lançamento */
  date: string;
  categoryId: ID | null;
  /** conta de origem (despesa/transferência) ou destino (receita). null quando é no cartão */
  accountId: ID | null;
  /** conta de destino, apenas para transferências */
  toAccountId: ID | null;
  /** cartão de crédito, quando a compra é no cartão */
  cardId: ID | null;
  /** mês da fatura ("YYYY-MM") em que a compra cai, apenas para cartão */
  invoiceMonth: string | null;
  /** pago / recebido. Para compras no cartão é sempre true (quem é paga é a fatura) */
  paid: boolean;
  /** agrupa as parcelas de uma mesma compra */
  installmentGroupId: ID | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  /** quando o lançamento foi gerado a partir de um fixo mensal */
  recurrenceId: ID | null;
  notes: string;
  /** id do lançamento no extrato importado (evita importar duas vezes) */
  externalId?: string | null;
}

/* ---------------------------- recurrences --------------------------- */

/** Lançamentos fixos mensais (salário, aluguel, assinaturas...) */
export interface Recurrence extends BaseDoc {
  type: "income" | "expense";
  description: string;
  amount: number;
  categoryId: ID | null;
  accountId: ID | null;
  cardId: ID | null;
  dayOfMonth: number;
  /** primeiro mês ("YYYY-MM") */
  startMonth: string;
  /** último mês ("YYYY-MM") ou null para sem fim */
  endMonth: string | null;
  /** meses pulados ("YYYY-MM") */
  skippedMonths: string[];
  active: boolean;
}

/* ------------------------------ invoices ---------------------------- */

/** Registro de pagamento de fatura. id = `${cardId}_${month}` */
export interface Invoice extends BaseDoc {
  cardId: ID;
  month: string;
  paid: boolean;
  paidAt: string | null;
  paidAmount: number;
  accountId: ID | null;
}

/* ------------------------------ agregados --------------------------- */

export interface FinanceData {
  accounts: Account[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  invoices: Invoice[];
}

export type CollectionName = keyof FinanceData;
export type DocOf<K extends CollectionName> = FinanceData[K][number];

export const COLLECTIONS: CollectionName[] = [
  "accounts",
  "cards",
  "categories",
  "transactions",
  "recurrences",
  "invoices",
];

export const emptyData = (): FinanceData => ({
  accounts: [],
  cards: [],
  categories: [],
  transactions: [],
  recurrences: [],
  invoices: [],
});

/** Lançamento exibido na tela: real ou previsto (gerado de um fixo mensal) */
export type Entry = Transaction & { virtual?: boolean };
