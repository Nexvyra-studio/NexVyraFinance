export function Logo({ big }: { big?: boolean }) {
  const s = big ? 52 : 34;
  return (
    <div className="flex items-center gap-2.5">
      <svg width={s} height={s} viewBox="0 0 40 40" aria-hidden>
        <rect width="40" height="40" rx="12" fill="var(--accent)" />
        <path d="M11 28V12l9 10.5L29 12v16" fill="none" stroke="var(--accent-ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="leading-none">
        <p className={big ? "text-2xl font-extrabold tracking-tight" : "text-[17px] font-extrabold tracking-tight"}>NexVyra</p>
        <p className={big ? "mt-1 text-sm font-semibold text-muted" : "mt-0.5 text-xs font-semibold text-muted"}>Finance</p>
      </div>
    </div>
  );
}
