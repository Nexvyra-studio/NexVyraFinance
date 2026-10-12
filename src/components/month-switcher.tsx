"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, currentMonth, monthLabel } from "@/lib/dates";
import { cx } from "./ui";

export function MonthSwitcher({ month, onChange, className }: { month: string; onChange: (m: string) => void; className?: string }) {
  const isCurrent = month === currentMonth();
  return (
    <div className={cx("flex items-center justify-between rounded-2xl bg-surface p-1", className)}>
      <button type="button" aria-label="Mês anterior" onClick={() => onChange(addMonths(month, -1))} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 active:scale-95">
        <ChevronLeft size={20} />
      </button>
      <button type="button" onClick={() => onChange(currentMonth())} className="flex flex-col items-center leading-tight">
        <span className="text-[15px] font-bold">{monthLabel(month)}</span>
        {!isCurrent && <span className="text-[11px] font-semibold text-accent-text">voltar para hoje</span>}
      </button>
      <button type="button" aria-label="Próximo mês" onClick={() => onChange(addMonths(month, 1))} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 active:scale-95">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
