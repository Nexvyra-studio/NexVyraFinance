"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addMonths, addMonthsToDate, monthOf } from "@/lib/dates";
import { invoiceId, invoiceMonthFor } from "@/lib/finance";
import { splitInstallments } from "@/lib/money";
import {
  DATA_SOURCE,
  createFirebaseRepository,
  createLocalRepository,
  type DataSource,
} from "@/lib/data";
import { readLocalData } from "@/lib/data/local-repository";
import type { FinanceRepository } from "@/lib/data/repository";
import { demoData, initialData, newId, nowStamp } from "@/lib/data/seed";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  COLLECTIONS,
  emptyData,
  type Account,
  type Category,
  type CollectionName,
  type CreditCard,
  type DocOf,
  type Entry,
  type FinanceData,
  type ID,
  type Recurrence,
  type Transaction,
  type TransactionType,
} from "@/lib/types";

export type Status = "loading" | "ready" | "signed-out" | "error";

export interface NewTransactionInput {
  type: TransactionType;
  description: string;
  /** valor total (em parcelado, o total da compra) */
  amount: number;
  date: string;
  categoryId: ID | null;
  accountId: ID | null;
  toAccountId: ID | null;
  cardId: ID | null;
  /** força a fatura (cartão). null = calcula pela data */
  invoiceMonth: string | null;
  paid: boolean;
  installments: number;
  repeatMonthly: boolean;
  notes: string;
}

export type SignInMethod =
  | { kind: "google" }
  | { kind: "email"; email: string; password: string }
  | { kind: "signup"; name: string; email: string; password: string };

type Upsertable<T> = Omit<T, "id" | "createdAt" | "updatedAt"> & { id?: ID; createdAt?: string };

export interface UserInfo {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  /** "password" e/ou "google.com" */
  providers: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
}

function toUserInfo(u: import("firebase/auth").User): UserInfo {
  return {
    uid: u.uid,
    name: u.displayName,
    email: u.email,
    photoURL: u.photoURL,
    providers: u.providerData.map((p) => p.providerId),
    createdAt: u.metadata.creationTime ?? null,
    lastLoginAt: u.metadata.lastSignInTime ?? null,
  };
}

interface FinanceContext {
  data: FinanceData;
  status: Status;
  source: DataSource;
  error: string | null;
  user: UserInfo | null;
  toast: string | null;
  notify: (msg: string) => void;

  addTransaction: (input: NewTransactionInput) => Promise<void>;
  saveEntry: (entry: Entry, patch: Partial<Transaction>) => Promise<void>;
  deleteEntry: (entry: Entry, scope?: "one" | "group") => Promise<void>;
  togglePaid: (entry: Entry) => Promise<void>;
  importTransactions: (txs: Omit<Transaction, "id" | "createdAt" | "updatedAt">[]) => Promise<number>;

  saveAccount: (a: Upsertable<Account>) => Promise<void>;
  deleteAccount: (id: ID) => Promise<void>;
  saveCard: (c: Upsertable<CreditCard>) => Promise<void>;
  deleteCard: (id: ID) => Promise<void>;
  saveCategory: (c: Upsertable<Category>) => Promise<void>;
  deleteCategory: (id: ID) => Promise<void>;
  saveRecurrence: (r: Upsertable<Recurrence>) => Promise<void>;
  deleteRecurrence: (id: ID) => Promise<void>;

  payInvoice: (cardId: ID, month: string, amount: number, accountId: ID | null) => Promise<void>;
  reopenInvoice: (cardId: ID, month: string) => Promise<void>;

  replaceData: (d: FinanceData) => Promise<void>;
  loadDemo: () => Promise<void>;
  resetData: () => Promise<void>;
  importLocalToFirebase: () => Promise<boolean>;
  signIn: (method: SignInMethod) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  updateName: (name: string) => Promise<string | null>;
  changePassword: (current: string, next: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<FinanceContext | null>(null);

export function useFinance() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFinance precisa estar dentro de <FinanceProvider>");
  return ctx;
}

function stamp<T extends object>(doc: T & { id?: ID; createdAt?: string }) {
  const now = nowStamp();
  return { ...doc, id: doc.id ?? newId(), createdAt: doc.createdAt ?? now, updatedAt: now };
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FinanceData>(emptyData);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const repoRef = useRef<FinanceRepository | null>(null);
  const dataRef = useRef<FinanceData>(data);
  dataRef.current = data;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /* ------------------------------ carregamento ------------------------------ */

  const loadFrom = useCallback(async (repo: FinanceRepository) => {
    repoRef.current = repo;
    let loaded = await repo.loadAll();
    if (loaded.accounts.length === 0 && loaded.categories.length === 0) {
      loaded = initialData();
      await repo.replaceAll(loaded);
    }
    setData(loaded);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        if (DATA_SOURCE === "local") {
          await loadFrom(createLocalRepository());
          return;
        }
        if (!isFirebaseConfigured()) {
          setError("NEXT_PUBLIC_DATA_SOURCE=firebase, mas as chaves NEXT_PUBLIC_FIREBASE_* não foram preenchidas no .env.local.");
          setStatus("error");
          return;
        }
        const { watchUser } = await import("@/lib/firebase/auth");
        unsub = watchUser(async (u) => {
          if (cancelled) return;
          if (!u) {
            setUser(null);
            setStatus("signed-out");
            return;
          }
          setUser(toUserInfo(u));
          setStatus("loading");
          await loadFrom(await createFirebaseRepository(u.uid));
        });
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [loadFrom]);

  /* ------------------------------ escrita base ------------------------------ */

  const upsert = useCallback(
    async <K extends CollectionName>(col: K, docs: DocOf<K>[]) => {
      if (!docs.length) return;
      setData((prev) => {
        const list = [...(prev[col] as DocOf<K>[])];
        for (const d of docs) {
          const i = list.findIndex((x) => x.id === d.id);
          if (i >= 0) list[i] = d;
          else list.push(d);
        }
        return { ...prev, [col]: list };
      });
      try {
        await repoRef.current?.upsert(col, docs);
      } catch (err) {
        console.error(err);
        notify("Erro ao salvar. Verifique sua conexão.");
      }
    },
    [notify],
  );

  const remove = useCallback(
    async (col: CollectionName, ids: ID[]) => {
      if (!ids.length) return;
      const set = new Set(ids);
      setData((prev) => ({
        ...prev,
        [col]: (prev[col] as { id: ID }[]).filter((d) => !set.has(d.id)),
      }));
      try {
        await repoRef.current?.remove(col, ids);
      } catch (err) {
        console.error(err);
        notify("Erro ao excluir. Verifique sua conexão.");
      }
    },
    [notify],
  );

  /* ------------------------------ lançamentos ------------------------------ */

  const addTransaction = useCallback(
    async (input: NewTransactionInput) => {
      const d = dataRef.current;
      const card = input.cardId ? d.cards.find((c) => c.id === input.cardId) : undefined;
      const baseInvoice = card ? input.invoiceMonth ?? invoiceMonthFor(card, input.date) : null;

      const make = (p: Partial<Transaction>): Transaction =>
        stamp({
          type: input.type,
          description: input.description.trim(),
          amount: input.amount,
          date: input.date,
          categoryId: input.type === "transfer" ? null : input.categoryId,
          accountId: card ? null : input.accountId,
          toAccountId: input.type === "transfer" ? input.toAccountId : null,
          cardId: card?.id ?? null,
          invoiceMonth: baseInvoice,
          paid: card ? true : input.paid,
          installmentGroupId: null,
          installmentNumber: null,
          installmentTotal: null,
          recurrenceId: null,
          notes: input.notes,
          ...p,
        }) as Transaction;

      if (input.repeatMonthly && input.type !== "transfer") {
        const rec = stamp({
          type: input.type,
          description: input.description.trim(),
          amount: input.amount,
          categoryId: input.categoryId,
          accountId: card ? null : input.accountId,
          cardId: card?.id ?? null,
          dayOfMonth: Number(input.date.slice(8, 10)),
          startMonth: monthOf(input.date),
          endMonth: null,
          skippedMonths: [],
          active: true,
        }) as Recurrence;
        await upsert("recurrences", [rec]);
        await upsert("transactions", [make({ recurrenceId: rec.id })]);
        notify("Fixo mensal criado");
        return;
      }

      const n = Math.max(1, Math.min(72, input.installments || 1));
      if (n === 1) {
        await upsert("transactions", [make({})]);
        notify("Lançamento salvo");
        return;
      }
      const group = newId();
      const parts = splitInstallments(input.amount, n).map((amount, i) =>
        make({
          amount,
          date: addMonthsToDate(input.date, i),
          invoiceMonth: baseInvoice ? addMonths(baseInvoice, i) : null,
          paid: card ? true : i === 0 ? input.paid : false,
          installmentGroupId: group,
          installmentNumber: i + 1,
          installmentTotal: n,
        }),
      );
      await upsert("transactions", parts);
      notify(`${n} parcelas lançadas`);
    },
    [upsert, notify],
  );

  const saveEntry = useCallback(
    async (entry: Entry, patch: Partial<Transaction>) => {
      const { virtual, ...rest } = entry;
      const next = { ...rest, ...patch, updatedAt: nowStamp() } as Transaction;
      if (virtual) {
        next.id = newId();
        next.createdAt = nowStamp();
      }
      const card = next.cardId ? dataRef.current.cards.find((c) => c.id === next.cardId) : undefined;
      if (card && patch.date && !patch.invoiceMonth && next.installmentNumber == null) {
        next.invoiceMonth = invoiceMonthFor(card, next.date);
      }
      if (!card) next.invoiceMonth = null;
      await upsert("transactions", [next]);
      notify("Lançamento atualizado");
    },
    [upsert, notify],
  );

  const skipMonth = useCallback(
    async (recurrenceId: ID, month: string) => {
      const r = dataRef.current.recurrences.find((x) => x.id === recurrenceId);
      if (!r) return;
      await upsert("recurrences", [
        { ...r, skippedMonths: [...new Set([...(r.skippedMonths ?? []), month])], updatedAt: nowStamp() },
      ]);
    },
    [upsert],
  );

  const deleteEntry = useCallback(
    async (entry: Entry, scope: "one" | "group" = "one") => {
      if (entry.recurrenceId) await skipMonth(entry.recurrenceId, monthOf(entry.date));
      if (entry.virtual) {
        notify("Removido deste mês");
        return;
      }
      if (scope === "group" && entry.installmentGroupId) {
        const ids = dataRef.current.transactions
          .filter((t) => t.installmentGroupId === entry.installmentGroupId)
          .map((t) => t.id);
        await remove("transactions", ids);
        notify(`${ids.length} parcelas excluídas`);
        return;
      }
      await remove("transactions", [entry.id]);
      notify("Lançamento excluído");
    },
    [remove, skipMonth, notify],
  );

  const togglePaid = useCallback(
    async (entry: Entry) => {
      if (entry.virtual) {
        await saveEntry(entry, { paid: true });
        return;
      }
      await upsert("transactions", [{ ...entry, paid: !entry.paid, updatedAt: nowStamp() }]);
    },
    [saveEntry, upsert],
  );

  const importTransactions = useCallback(
    async (txs: Omit<Transaction, "id" | "createdAt" | "updatedAt">[]) => {
      const docs = txs.map((t) => stamp(t) as Transaction);
      await upsert("transactions", docs);
      notify(`${docs.length} lançamentos importados`);
      return docs.length;
    },
    [upsert, notify],
  );

  /* --------------------------- contas / cartões / etc --------------------------- */

  const saveAccount = useCallback(
    async (a: Upsertable<Account>) => {
      await upsert("accounts", [stamp(a) as Account]);
      notify("Conta salva");
    },
    [upsert, notify],
  );

  const deleteAccount = useCallback(
    async (id: ID) => {
      const d = dataRef.current;
      const used =
        d.transactions.some((t) => t.accountId === id || t.toAccountId === id) ||
        d.invoices.some((i) => i.accountId === id);
      if (used) {
        const acc = d.accounts.find((a) => a.id === id)!;
        await upsert("accounts", [{ ...acc, archived: true, updatedAt: nowStamp() }]);
        notify("Conta arquivada (tem lançamentos)");
      } else {
        await remove("accounts", [id]);
        notify("Conta excluída");
      }
    },
    [upsert, remove, notify],
  );

  const saveCard = useCallback(
    async (c: Upsertable<CreditCard>) => {
      await upsert("cards", [stamp(c) as CreditCard]);
      notify("Cartão salvo");
    },
    [upsert, notify],
  );

  const deleteCard = useCallback(
    async (id: ID) => {
      const d = dataRef.current;
      if (d.transactions.some((t) => t.cardId === id)) {
        const card = d.cards.find((c) => c.id === id)!;
        await upsert("cards", [{ ...card, archived: true, updatedAt: nowStamp() }]);
        notify("Cartão arquivado (tem compras)");
      } else {
        await remove("cards", [id]);
        notify("Cartão excluído");
      }
    },
    [upsert, remove, notify],
  );

  const saveCategory = useCallback(
    async (c: Upsertable<Category>) => {
      await upsert("categories", [stamp(c) as Category]);
      notify("Categoria salva");
    },
    [upsert, notify],
  );

  const deleteCategory = useCallback(
    async (id: ID) => {
      const d = dataRef.current;
      const now = nowStamp();
      await upsert(
        "transactions",
        d.transactions.filter((t) => t.categoryId === id).map((t) => ({ ...t, categoryId: null, updatedAt: now })),
      );
      await upsert(
        "recurrences",
        d.recurrences.filter((r) => r.categoryId === id).map((r) => ({ ...r, categoryId: null, updatedAt: now })),
      );
      await remove("categories", [id]);
      notify("Categoria excluída");
    },
    [upsert, remove, notify],
  );

  const saveRecurrence = useCallback(
    async (r: Upsertable<Recurrence>) => {
      await upsert("recurrences", [stamp(r) as Recurrence]);
      notify("Fixo salvo");
    },
    [upsert, notify],
  );

  const deleteRecurrence = useCallback(
    async (id: ID) => {
      // mantém os lançamentos já confirmados, só desvincula
      const d = dataRef.current;
      await upsert(
        "transactions",
        d.transactions
          .filter((t) => t.recurrenceId === id)
          .map((t) => ({ ...t, recurrenceId: null, updatedAt: nowStamp() })),
      );
      await remove("recurrences", [id]);
      notify("Fixo excluído");
    },
    [upsert, remove, notify],
  );

  /* -------------------------------- faturas -------------------------------- */

  const payInvoice = useCallback(
    async (cardId: ID, month: string, amount: number, accountId: ID | null) => {
      const id = invoiceId(cardId, month);
      const existing = dataRef.current.invoices.find((i) => i.id === id);
      const now = nowStamp();
      await upsert("invoices", [
        {
          id,
          cardId,
          month,
          paid: true,
          paidAt: now,
          paidAmount: amount,
          accountId,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        },
      ]);
      notify("Fatura paga");
    },
    [upsert, notify],
  );

  const reopenInvoice = useCallback(
    async (cardId: ID, month: string) => {
      await remove("invoices", [invoiceId(cardId, month)]);
      notify("Pagamento da fatura desfeito");
    },
    [remove, notify],
  );

  /* --------------------------------- dados --------------------------------- */

  const replaceData = useCallback(
    async (d: FinanceData) => {
      const clean = emptyData();
      for (const c of COLLECTIONS) if (Array.isArray(d[c])) (clean[c] as unknown[]) = d[c];
      setData(clean);
      await repoRef.current?.replaceAll(clean);
    },
    [],
  );

  const loadDemo = useCallback(async () => {
    await replaceData(demoData());
    notify("Dados de exemplo carregados");
  }, [replaceData, notify]);

  const resetData = useCallback(async () => {
    await replaceData(initialData());
    notify("Tudo zerado");
  }, [replaceData, notify]);

  const importLocalToFirebase = useCallback(async () => {
    const local = readLocalData();
    if (!local) return false;
    await replaceData(local);
    notify("Dados do navegador enviados para o Firebase");
    return true;
  }, [replaceData, notify]);

  /** Login. Retorna a mensagem de erro (ou null se deu certo) */
  const signIn = useCallback(async (method: SignInMethod): Promise<string | null> => {
    const auth = await import("@/lib/firebase/auth");
    try {
      if (method.kind === "google") await auth.signInWithGoogle();
      else if (method.kind === "email") await auth.signInWithEmail(method.email, method.password);
      else {
        await auth.signUpWithEmail(method.name, method.email, method.password);
        const u = auth.currentUser();
        if (u) setUser(toUserInfo(u)); // já com o nome informado no cadastro
      }
      return null;
    } catch (err) {
      console.error(err);
      return auth.authErrorMessage(err);
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<string | null> => {
    const auth = await import("@/lib/firebase/auth");
    try {
      await auth.resetPassword(email);
      return null;
    } catch (err) {
      return auth.authErrorMessage(err);
    }
  }, []);

  const updateName = useCallback(async (name: string): Promise<string | null> => {
    const auth = await import("@/lib/firebase/auth");
    try {
      const u = await auth.updateDisplayName(name);
      setUser(toUserInfo(u));
      return null;
    } catch (err) {
      return auth.authErrorMessage(err);
    }
  }, []);

  const changePassword = useCallback(async (current: string, next: string): Promise<string | null> => {
    const auth = await import("@/lib/firebase/auth");
    try {
      await auth.changePassword(current, next);
      return null;
    } catch (err) {
      return auth.authErrorMessage(err);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { signOutUser } = await import("@/lib/firebase/auth");
    repoRef.current = null; // nada mais é gravado depois de sair
    setData(emptyData());
    await signOutUser();
  }, []);

  const value = useMemo<FinanceContext>(
    () => ({
      data,
      status,
      source: DATA_SOURCE,
      error,
      user,
      toast,
      notify,
      addTransaction,
      saveEntry,
      deleteEntry,
      togglePaid,
      importTransactions,
      saveAccount,
      deleteAccount,
      saveCard,
      deleteCard,
      saveCategory,
      deleteCategory,
      saveRecurrence,
      deleteRecurrence,
      payInvoice,
      reopenInvoice,
      replaceData,
      loadDemo,
      resetData,
      importLocalToFirebase,
      signIn,
      resetPassword,
      updateName,
      changePassword,
      signOut,
    }),
    [
      data, status, error, user, toast, notify, addTransaction, saveEntry, deleteEntry, togglePaid, importTransactions,
      saveAccount, deleteAccount, saveCard, deleteCard, saveCategory, deleteCategory, saveRecurrence,
      deleteRecurrence, payInvoice, reopenInvoice, replaceData, loadDemo, resetData,
      importLocalToFirebase, signIn, resetPassword, updateName, changePassword, signOut,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ------------------------------- seletores ------------------------------- */

export function useLookups() {
  const { data } = useFinance();
  return useMemo(() => {
    const cat = new Map(data.categories.map((c) => [c.id, c]));
    const acc = new Map(data.accounts.map((a) => [a.id, a]));
    const card = new Map(data.cards.map((c) => [c.id, c]));
    return {
      category: (id: ID | null | undefined) => (id ? cat.get(id) : undefined),
      account: (id: ID | null | undefined) => (id ? acc.get(id) : undefined),
      card: (id: ID | null | undefined) => (id ? card.get(id) : undefined),
    };
  }, [data.categories, data.accounts, data.cards]);
}
