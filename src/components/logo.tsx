/* eslint-disable @next/next/no-img-element */
export function Logo({ big }: { big?: boolean }) {
  const s = big ? 64 : 38;
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="" width={s} height={Math.round(s * 0.9)} style={{ width: s, height: "auto" }} className="drop-shadow-[0_4px_14px_rgb(10_108_255/0.45)]" />
      <div className="leading-none">
        <p className={big ? "text-2xl font-extrabold tracking-tight" : "text-[17px] font-extrabold tracking-tight"}>NexVyra</p>
        <p className={big ? "mt-1 text-sm font-semibold text-brand" : "mt-0.5 text-xs font-semibold text-brand"}>Finance</p>
      </div>
    </div>
  );
}
