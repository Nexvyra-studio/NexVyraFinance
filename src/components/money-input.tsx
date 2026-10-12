"use client";

import { cx, inputClass } from "./ui";

const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Campo de valor estilo app de banco: você digita só números e ele
 * preenche da direita para a esquerda (1 -> 0,01 -> 0,12 -> 1,23).
 * Valor em centavos.
 */
export function MoneyInput({
  value,
  onChange,
  big,
  className,
  autoFocus,
  allowNegative,
}: {
  value: number;
  onChange: (cents: number) => void;
  big?: boolean;
  className?: string;
  autoFocus?: boolean;
  allowNegative?: boolean;
}) {
  const negative = allowNegative && value < 0;
  const display = fmt.format(Math.abs(value) / 100);

  return (
    <div className={cx("relative flex items-center", big ? "" : inputClass, className)}>
      <span className={cx("mr-1 font-semibold text-muted", big ? "text-2xl" : "text-[15px]")}>
        {negative ? "−R$" : "R$"}
      </span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          const cents = Number(digits || "0");
          onChange(negative ? -cents : cents);
        }}
        onFocus={(e) => {
          const el = e.target;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        }}
        className={cx(
          "num w-full bg-transparent font-bold text-fg outline-none",
          big ? "text-[40px] leading-tight" : "text-[15px]",
        )}
      />
      {allowNegative && (
        <button
          type="button"
          onClick={() => onChange(-value)}
          className="ml-2 shrink-0 rounded-lg bg-surface-3 px-2 py-1 text-xs font-semibold text-muted"
        >
          ±
        </button>
      )}
    </div>
  );
}
