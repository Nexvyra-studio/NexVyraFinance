export const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => toISODate(new Date());
export const monthOf = (iso: string) => iso.slice(0, 7);
export const currentMonth = () => monthOf(todayISO());

function parseMonth(month: string): [number, number] {
  const [y, m] = month.split("-").map(Number);
  return [y, m];
}

export function addMonths(month: string, n: number): string {
  const [y, m] = parseMonth(month);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = parseMonth(month);
  return new Date(y, m, 0).getDate();
}

/** dia do mês limitado ao último dia (ex: dia 31 em fevereiro -> 28/29) */
export function dateInMonth(month: string, day: number): string {
  return `${month}-${pad(Math.min(Math.max(day, 1), daysInMonth(month)))}`;
}

export function addMonthsToDate(iso: string, n: number): string {
  return dateInMonth(addMonths(monthOf(iso), n), Number(iso.slice(8, 10)));
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

export function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let m = from;
  let guard = 0;
  while (m <= to && guard++ < 600) {
    out.push(m);
    m = addMonths(m, 1);
  }
  return out;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function monthLabel(month: string, withYear = true): string {
  const [y, m] = parseMonth(month);
  const name = MONTHS[m - 1];
  const cap = name[0].toUpperCase() + name.slice(1);
  return withYear ? `${cap} ${y}` : cap;
}

export function monthShort(month: string): string {
  const [y, m] = parseMonth(month);
  const s = MONTHS[m - 1].slice(0, 3);
  return y === new Date().getFullYear() ? s : `${s}/${String(y).slice(2)}`;
}

/** "Out 26" */
export function monthShortYear(month: string): string {
  const [y, m] = parseMonth(month);
  const s = MONTHS[m - 1].slice(0, 3);
  return `${s[0].toUpperCase()}${s.slice(1)} ${String(y).slice(2)}`;
}

/** "Hoje", "Ontem", "Amanhã" ou "qua, 14 out" */
export function dayLabel(iso: string): string {
  const diff = diffDays(todayISO(), iso);
  if (diff === 0) return "Hoje";
  if (diff === -1) return "Ontem";
  if (diff === 1) return "Amanhã";
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${wd}, ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** "14/10" */
export function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
