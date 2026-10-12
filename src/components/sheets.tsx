"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Entry } from "@/lib/types";
import type { NewTransactionInput } from "@/store/finance-store";
import { TransactionForm } from "./transaction-form";

interface SheetsCtx {
  openNew: (defaults?: Partial<NewTransactionInput>) => void;
  openEdit: (entry: Entry) => void;
}

const Ctx = createContext<SheetsCtx | null>(null);

export function useSheets() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSheets fora do SheetsProvider");
  return c;
}

/** Controla o formulário de lançamento, que pode ser aberto de qualquer tela */
export function SheetsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ key: number; entry?: Entry; defaults?: Partial<NewTransactionInput> } | null>(null);

  const openNew = useCallback((defaults?: Partial<NewTransactionInput>) => {
    setState({ key: Date.now(), defaults });
  }, []);
  const openEdit = useCallback((entry: Entry) => setState({ key: Date.now(), entry }), []);
  const close = useCallback(() => setState(null), []);
  const value = useMemo(() => ({ openNew, openEdit }), [openNew, openEdit]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {state && (
        <TransactionForm key={state.key} entry={state.entry} defaults={state.defaults} onClose={close} />
      )}
    </Ctx.Provider>
  );
}
