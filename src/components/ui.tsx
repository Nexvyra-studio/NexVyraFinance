"use client";

import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { formatBRL } from "@/lib/money";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* --------------------------------- Money --------------------------------- */

export function Money({
  value,
  className,
  sign,
  colored,
}: {
  value: number;
  className?: string;
  /** mostra + / − */
  sign?: "income" | "expense" | "auto";
  colored?: boolean;
}) {
  const kind = sign === "auto" ? (value < 0 ? "expense" : "income") : sign;
  const prefix = kind === "income" ? "+ " : kind === "expense" ? "− " : value < 0 ? "− " : "";
  const abs = sign || value < 0 ? Math.abs(value) : value;
  return (
    <span
      className={cx(
        "num sensitive whitespace-nowrap",
        colored && kind === "income" && "text-income",
        colored && kind === "expense" && "text-expense",
        className,
      )}
    >
      {prefix}
      {formatBRL(abs)}
    </span>
  );
}

/* --------------------------------- Button -------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-13 px-5 text-base",
        variant === "primary" && "bg-brand text-accent-ink shadow-[0_8px_20px_-10px_rgb(10_108_255/0.8)] hover:brightness-110",
        variant === "secondary" && "bg-surface-2 text-fg hover:bg-surface-3",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
        variant === "danger" && "bg-expense/12 text-expense hover:bg-expense/20",
        className,
      )}
    />
  );
}

export function IconButton({
  className,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        "grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg active:scale-95",
        className,
      )}
    />
  );
}

/* --------------------------------- Card ---------------------------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-3xl border border-line bg-surface p-4", className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

/* -------------------------------- Segmented ------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; activeClass?: string }[];
  className?: string;
}) {
  return (
    <div className={cx("flex rounded-2xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
            value === o.value ? o.activeClass ?? "bg-surface-3 text-fg shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- Field --------------------------------- */

/** Rótulo + campo. Use `group` quando o conteúdo for um grupo de botões (chips, grade) */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: ReactNode; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="mb-1.5 block px-1 text-xs font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block px-1 text-xs text-faint">{hint}</span>}
    </Tag>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-[15px] text-fg outline-none transition placeholder:text-faint focus:border-accent-text/60";

/* --------------------------------- Toggle -------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-left"
    >
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-accent" : "bg-surface-3",
        )}
      >
        <span
          className={cx(
            "absolute top-1 size-5 rounded-full shadow transition-all",
            checked ? "left-6 bg-accent-ink" : "left-1 bg-muted",
          )}
        />
      </span>
    </button>
  );
}

/* --------------------------------- Sheet --------------------------------- */

/** Bottom sheet no celular, modal centralizado no desktop */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal>
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-line bg-surface shadow-soft md:max-w-lg md:rounded-[28px]">
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-surface-3 md:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <IconButton label="Fechar" onClick={onClose} className="-mr-2">
            <X size={20} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------- Confirm ---------------------------------- */

export function Confirm({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  danger,
  onConfirm,
  onClose,
  extra,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  extra?: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {message && <p className="text-sm text-muted">{message}</p>}
      <div className="mt-5 flex flex-col gap-2 pb-2">
        <Button
          variant={danger ? "danger" : "primary"}
          size="lg"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
        {extra}
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  );
}

/* ------------------------------- Progress -------------------------------- */

export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct * 100}%`, background: color ?? "var(--accent)" }}
      />
    </div>
  );
}

/* -------------------------------- Empty ---------------------------------- */

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-14 place-items-center rounded-3xl bg-surface-2 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------- Badge ----------------------------------- */

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "income" | "expense" | "warn" | "accent" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "muted" && "bg-surface-3 text-muted",
        tone === "income" && "bg-income/15 text-income",
        tone === "expense" && "bg-expense/15 text-expense",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "accent" && "bg-accent/20 text-accent-text",
      )}
    >
      {children}
    </span>
  );
}
