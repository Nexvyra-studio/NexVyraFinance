"use client";

import { ChevronLeft, ChevronRight, CreditCard, Minus, Plus, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, addMonths, monthLabel, monthOf, todayISO } from "@/lib/dates";
import { closingDateFor, invoiceMonthFor } from "@/lib/finance";
import { formatBRL, splitInstallments } from "@/lib/money";
import type { Entry, TransactionType } from "@/lib/types";
import { useFinance, type NewTransactionInput } from "@/store/finance-store";
import { CategoryIcon } from "./category-icon";
import { MoneyInput } from "./money-input";
import { Button, Confirm, Field, Segmented, Sheet, Toggle, cx, inputClass } from "./ui";

type Source = { kind: "account" | "card"; id: string } | null;
type Repeat = "once" | "installments" | "monthly";

export function TransactionForm({
  entry,
  defaults,
  onClose,
}: {
  entry?: Entry;
  defaults?: Partial<NewTransactionInput>;
  onClose: () => void;
}) {
  const { data, addTransaction, saveEntry, deleteEntry } = useFinance();
  const editing = !!entry;
  const accounts = data.accounts.filter((a) => !a.archived || a.id === entry?.accountId || a.id === entry?.toAccountId);
  const cards = data.cards.filter((c) => !c.archived || c.id === entry?.cardId);

  const [type, setType] = useState<TransactionType>(entry?.type ?? defaults?.type ?? "expense");
  const [amount, setAmount] = useState(entry?.amount ?? defaults?.amount ?? 0);
  const [description, setDescription] = useState(entry?.description ?? defaults?.description ?? "");
  const [date, setDateState] = useState(entry?.date ?? defaults?.date ?? todayISO());
  const setDate = (v: string) => {
    setDateState(v);
    // mudou a data: recalcula a fatura (exceto parcelas, que mantêm a sequência)
    if (!entry?.installmentTotal) setInvoiceOverride(null);
  };
  const [categoryId, setCategoryId] = useState<string | null>(entry?.categoryId ?? defaults?.categoryId ?? null);
  const [source, setSource] = useState<Source>(() => {
    const cardId = entry?.cardId ?? defaults?.cardId;
    if (cardId) return { kind: "card", id: cardId };
    const accId = entry?.accountId ?? defaults?.accountId ?? accounts[0]?.id;
    return accId ? { kind: "account", id: accId } : null;
  });
  const [toAccountId, setToAccountId] = useState<string | null>(
    entry?.toAccountId ?? defaults?.toAccountId ?? accounts[1]?.id ?? null,
  );
  const [paid, setPaid] = useState(entry?.paid ?? defaults?.paid ?? true);
  const [repeat, setRepeat] = useState<Repeat>("once");
  const [installments, setInstallments] = useState(2);
  const [invoiceOverride, setInvoiceOverride] = useState<string | null>(entry?.invoiceMonth ?? defaults?.invoiceMonth ?? null);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const isTransfer = type === "transfer";
  const card = source?.kind === "card" ? data.cards.find((c) => c.id === source.id) : undefined;
  const autoInvoice = card ? invoiceMonthFor(card, date) : null;
  const invoiceMonth = card ? invoiceOverride ?? autoInvoice : null;
  const categories = data.categories
    .filter((c) => c.kind === (type === "income" ? "income" : "expense"))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const changeType = (t: TransactionType) => {
    setType(t);
    setCategoryId(null);
    if (t !== "expense" && source?.kind === "card") setSource(accounts[0] ? { kind: "account", id: accounts[0].id } : null);
    if (t === "transfer" && repeat !== "once") setRepeat("once");
  };

  const valid =
    amount > 0 &&
    !!source &&
    (!isTransfer || (toAccountId && toAccountId !== source.id)) &&
    (description.trim() || categoryId || isTransfer);

  const installmentPreview = useMemo(() => {
    if (repeat !== "installments" || amount <= 0) return null;
    const parts = splitInstallments(amount, installments);
    return `${installments}x de ${formatBRL(parts[parts.length - 1])}`;
  }, [repeat, amount, installments]);

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    const cat = data.categories.find((c) => c.id === categoryId);
    const desc = description.trim() || (isTransfer ? "Transferência" : cat?.name ?? "");
    try {
      if (entry) {
        await saveEntry(entry, {
          type,
          description: desc,
          amount,
          date,
          categoryId: isTransfer ? null : categoryId,
          accountId: source?.kind === "account" ? source.id : null,
          toAccountId: isTransfer ? toAccountId : null,
          cardId: card?.id ?? null,
          invoiceMonth,
          paid: card ? true : paid,
          notes,
        });
      } else {
        await addTransaction({
          type,
          description: desc,
          amount,
          date,
          categoryId,
          accountId: source?.kind === "account" ? source.id : null,
          toAccountId,
          cardId: card?.id ?? null,
          invoiceMonth: invoiceOverride,
          paid,
          installments: repeat === "installments" ? installments : 1,
          repeatMonthly: repeat === "monthly",
          notes,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const title = editing
    ? entry.virtual
      ? "Confirmar previsto"
      : "Editar lançamento"
    : type === "income"
      ? "Nova receita"
      : type === "transfer"
        ? "Nova transferência"
        : "Nova despesa";


  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={title}
        footer={
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" className="w-12 shrink-0 px-0" onClick={() => setConfirmDelete(true)} aria-label="Excluir">
                <Trash2 size={18} />
              </Button>
            )}
            <Button size="lg" className="flex-1" disabled={!valid || saving} onClick={submit}>
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <Segmented
            value={type}
            onChange={changeType}
            options={[
              { value: "expense", label: "Despesa", activeClass: "bg-expense/15 text-expense" },
              { value: "income", label: "Receita", activeClass: "bg-income/15 text-income" },
              { value: "transfer", label: "Transferir", activeClass: "bg-surface-3 text-fg" },
            ]}
          />

          <div className="rounded-3xl bg-surface-2 px-4 py-3">
            <span className="text-xs font-semibold text-muted">
              {repeat === "installments" ? "Valor total da compra" : "Valor"}
            </span>
            <MoneyInput value={amount} onChange={setAmount} big autoFocus={!editing} />
            {installmentPreview && <p className="text-sm font-semibold text-accent-text">{installmentPreview}</p>}
            {entry?.installmentTotal && (
              <p className="text-xs text-muted">
                Parcela {entry.installmentNumber} de {entry.installmentTotal} (editar altera só esta parcela)
              </p>
            )}
          </div>

          <Field label="Descrição">
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isTransfer ? "Transferência" : "Ex: Mercado, Uber, Salário..."}
              maxLength={80}
            />
          </Field>

          {/* origem */}
          <Field label={isTransfer ? "De" : type === "income" ? "Receber em" : "Pagar com"} group>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {accounts.map((a) => (
                <Chip
                  key={a.id}
                  active={source?.kind === "account" && source.id === a.id}
                  onClick={() => setSource({ kind: "account", id: a.id })}
                  color={a.color}
                  icon={<Wallet size={15} />}
                >
                  {a.name}
                </Chip>
              ))}
              {type === "expense" &&
                cards.map((c) => (
                  <Chip
                    key={c.id}
                    active={source?.kind === "card" && source.id === c.id}
                    onClick={() => {
                      setSource({ kind: "card", id: c.id });
                      setInvoiceOverride(null);
                    }}
                    color={c.color}
                    icon={<CreditCard size={15} />}
                  >
                    {c.name}
                  </Chip>
                ))}
            </div>
          </Field>

          {isTransfer && (
            <Field label="Para" group>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {accounts
                  .filter((a) => a.id !== source?.id)
                  .map((a) => (
                    <Chip key={a.id} active={toAccountId === a.id} onClick={() => setToAccountId(a.id)} color={a.color} icon={<Wallet size={15} />}>
                      {a.name}
                    </Chip>
                  ))}
              </div>
              {accounts.length < 2 && <p className="mt-1 px-1 text-xs text-warn">Cadastre outra conta em Ajustes para transferir.</p>}
            </Field>
          )}

          {/* categoria */}
          {!isTransfer && (
            <Field label="Categoria" group>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                    className={cx(
                      "flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 transition",
                      categoryId === c.id ? "border-accent-text/70 bg-surface-2" : "border-transparent hover:bg-surface-2",
                    )}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size={36} />
                    <span className="w-full truncate text-center text-[11px] font-medium text-muted">{c.name}</span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* data */}
          <Field label={card ? "Data da compra" : "Data"} group>
            <div className="flex gap-2">
              {[
                { label: "Hoje", value: todayISO() },
                { label: "Ontem", value: addDays(todayISO(), -1) },
              ].map((d) => (
                <button
                  type="button"
                  key={d.label}
                  onClick={() => setDate(d.value)}
                  className={cx(
                    "h-12 shrink-0 rounded-2xl px-4 text-sm font-semibold transition",
                    date === d.value ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
                  )}
                >
                  {d.label}
                </button>
              ))}
              <input type="date" className={cx(inputClass, "min-w-0")} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
          </Field>

          {/* fatura */}
          {card && invoiceMonth && (
            <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2.5">
              <div>
                <p className="text-xs font-semibold text-muted">Entra na fatura de</p>
                <p className="font-semibold">{monthLabel(invoiceMonth)}</p>
                <p className="text-[11px] text-faint">
                  fecha {closingDateFor(card, invoiceMonth).split("-").reverse().slice(0, 2).join("/")}
                </p>
              </div>
              <div className="flex gap-1">
                <button type="button" aria-label="Fatura anterior" className="grid size-9 place-items-center rounded-full bg-surface-3" onClick={() => setInvoiceOverride(addMonths(invoiceMonth, -1))}>
                  <ChevronLeft size={18} />
                </button>
                <button type="button" aria-label="Próxima fatura" className="grid size-9 place-items-center rounded-full bg-surface-3" onClick={() => setInvoiceOverride(addMonths(invoiceMonth, 1))}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* repetir */}
          {!editing && !isTransfer && (
            <Field label="Repetição" group>
              <Segmented
                value={repeat}
                onChange={setRepeat}
                options={[
                  { value: "once", label: "Única" },
                  { value: "installments", label: "Parcelada" },
                  { value: "monthly", label: "Fixa mensal" },
                ]}
              />
              {repeat === "installments" && (
                <div className="mt-2 flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2">
                  <span className="text-sm text-muted">Número de parcelas</span>
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label="Menos parcelas" className="grid size-9 place-items-center rounded-full bg-surface-3" onClick={() => setInstallments((n) => Math.max(2, n - 1))}>
                      <Minus size={16} />
                    </button>
                    <span className="num w-8 text-center text-lg font-bold">{installments}x</span>
                    <button type="button" aria-label="Mais parcelas" className="grid size-9 place-items-center rounded-full bg-surface-3" onClick={() => setInstallments((n) => Math.min(48, n + 1))}>
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )}
              {repeat === "monthly" && (
                <p className="mt-1.5 px-1 text-xs text-muted">
                  Vai aparecer todo dia {Number(date.slice(8, 10))} a partir de {monthLabel(monthOf(date))}. Gerencie em Ajustes → Fixos.
                </p>
              )}
            </Field>
          )}

          {/* status */}
          {!card && (
            <Toggle
              checked={paid}
              onChange={setPaid}
              label={type === "income" ? "Já recebi" : isTransfer ? "Já transferi" : "Já paguei"}
              description={
                paid
                  ? "Entra no saldo atual"
                  : repeat === "installments"
                    ? "Fica como pendente e entra na previsão"
                    : "Fica pendente e entra na previsão"
              }
            />
          )}

          <Field label="Observação (opcional)">
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
          </Field>
        </div>
      </Sheet>

      {entry && (
        <Confirm
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={entry.virtual ? "Pular este mês?" : "Excluir lançamento?"}
          message={
            entry.virtual || entry.recurrenceId
              ? "Este lançamento é de um fixo mensal. Ele some só deste mês; o fixo continua nos próximos."
              : entry.installmentTotal
                ? "Essa compra é parcelada. Quer excluir só esta parcela ou todas?"
                : "Essa ação não pode ser desfeita."
          }
          confirmLabel={entry.virtual ? "Pular este mês" : entry.installmentTotal ? "Excluir só esta parcela" : "Excluir"}
          danger
          onConfirm={async () => {
            await deleteEntry(entry, "one");
            onClose();
          }}
          extra={
            entry.installmentTotal ? (
              <Button
                variant="danger"
                size="lg"
                onClick={async () => {
                  await deleteEntry(entry, "group");
                  setConfirmDelete(false);
                  onClose();
                }}
              >
                Excluir todas as {entry.installmentTotal} parcelas
              </Button>
            ) : null
          }
        />
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3.5 text-sm font-semibold transition",
        active ? "border-accent-text/70 bg-surface-2 text-fg" : "border-line text-muted hover:bg-surface-2",
      )}
    >
      <span style={{ color }}>{icon}</span>
      {children}
    </button>
  );
}
