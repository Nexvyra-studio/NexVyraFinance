"use client";

import { Check, CreditCard, Repeat } from "lucide-react";
import { diffDays, shortDate, todayISO } from "@/lib/dates";
import type { Entry } from "@/lib/types";
import { useFinance, useLookups } from "@/store/finance-store";
import { CategoryIcon } from "./category-icon";
import { useSheets } from "./sheets";
import { Badge, Money, cx } from "./ui";

export function EntryRow({ entry, showDate, hidePayButton }: { entry: Entry; showDate?: boolean; hidePayButton?: boolean }) {
  const { togglePaid } = useFinance();
  const { openEdit } = useSheets();
  const lk = useLookups();
  const cat = lk.category(entry.categoryId);
  const card = lk.card(entry.cardId);
  const acc = lk.account(entry.accountId);
  const to = lk.account(entry.toAccountId);
  const isTransfer = entry.type === "transfer";
  const pendingAccount = !entry.cardId && !entry.paid;
  const overdue = pendingAccount && diffDays(entry.date, todayISO()) > 0;

  const where = isTransfer
    ? `${acc?.name ?? "?"} → ${to?.name ?? "?"}`
    : card
      ? card.name
      : acc?.name ?? "Sem conta";

  return (
    <div className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-surface-2/60">
      <button type="button" onClick={() => openEdit(entry)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <CategoryIcon icon={cat?.icon} color={cat?.color} transfer={isTransfer} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cx("truncate text-[15px] font-semibold", entry.virtual && "text-muted")}>
              {entry.description || cat?.name || "Sem descrição"}
            </span>
            {entry.installmentTotal && (
              <span className="shrink-0 text-xs font-semibold text-muted">
                {entry.installmentNumber}/{entry.installmentTotal}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5 truncate text-xs text-muted">
            {card && <CreditCard size={12} className="shrink-0" />}
            {entry.recurrenceId && <Repeat size={12} className="shrink-0" />}
            <span className="truncate">
              {showDate && `${shortDate(entry.date)} · `}
              {cat?.name ? `${cat.name} · ` : ""}
              {where}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Money
            value={entry.amount}
            sign={isTransfer ? undefined : entry.type === "income" ? "income" : "expense"}
            colored={entry.type === "income"}
            className="text-[15px] font-bold"
          />
          {entry.virtual ? (
            <Badge>previsto</Badge>
          ) : overdue ? (
            <Badge tone="expense">atrasado</Badge>
          ) : pendingAccount ? (
            <Badge tone="warn">{entry.type === "income" ? "a receber" : "a pagar"}</Badge>
          ) : null}
        </span>
      </button>
      {pendingAccount && !hidePayButton && (
        <button
          type="button"
          aria-label={entry.type === "income" ? "Marcar como recebido" : "Marcar como pago"}
          title={entry.type === "income" ? "Marcar como recebido" : "Marcar como pago"}
          onClick={() => togglePaid(entry)}
          className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-dashed border-faint text-faint transition hover:border-income hover:text-income active:scale-90"
        >
          <Check size={16} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
