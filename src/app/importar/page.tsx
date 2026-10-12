"use client";

import { Check, CircleCheck, CreditCard, FileUp, Info, LoaderCircle, Repeat, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { CategoryIcon } from "@/components/category-icon";
import { Badge, Button, Card, Empty, Money, SectionTitle, Toggle, cx } from "@/components/ui";
import { addMonths, monthLabel, shortDate, todayISO } from "@/lib/dates";
import { invoiceMonthFor } from "@/lib/finance";
import {
  descriptionKey,
  interpret,
  loadLearned,
  looksLikeInternal,
  parseStatement,
  prettyDescription,
  readFileText,
  saveLearned,
  suggestCategory,
  type ParseResult,
} from "@/lib/importer";
import type { Transaction } from "@/lib/types";
import { useFinance } from "@/store/finance-store";

type Dest = { kind: "account" | "card"; id: string };
type Status = "new" | "imported" | "duplicate" | "internal";

interface Row {
  key: string;
  externalId: string;
  date: string;
  rawDescription: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  status: Status;
  suggested: string | null;
}

export default function ImportarPage() {
  const { data, importTransactions } = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const accounts = data.accounts.filter((a) => !a.archived);
  const cards = data.cards.filter((c) => !c.archived);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dest, setDest] = useState<Dest | null>(accounts[0] ? { kind: "account", id: accounts[0].id } : null);
  const [invert, setInvert] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState<string>("auto");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [learned] = useState(() => (typeof window === "undefined" ? {} : loadLearned()));

  const card = dest?.kind === "card" ? data.cards.find((c) => c.id === dest.id) : undefined;

  /* -------------------------- linhas calculadas -------------------------- */
  const rows: Row[] = useMemo(() => {
    if (!parsed || !dest) return [];
    const existingIds = new Set(data.transactions.map((t) => t.externalId).filter(Boolean) as string[]);
    const sameDest = data.transactions.filter((t) =>
      dest.kind === "card" ? t.cardId === dest.id : t.accountId === dest.id && !t.cardId,
    );
    return parsed.rows
      .map((r) => {
        const { type, amount } = interpret(parsed.kind, r.rawAmount, invert);
        const externalId = `${dest.id}:${r.key}`;
        let status: Status = "new";
        if (existingIds.has(externalId)) status = "imported";
        else if (looksLikeInternal(r.description)) status = "internal";
        else if (sameDest.some((t) => t.date === r.date && t.amount === amount && t.type === type)) status = "duplicate";
        return {
          key: r.key,
          externalId,
          date: r.date,
          rawDescription: r.description,
          description: prettyDescription(r.description),
          type,
          amount,
          status,
          suggested: suggestCategory(r.description, type, data.categories, learned),
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [parsed, dest, invert, data.transactions, data.categories, learned]);

  const isSelected = (r: Row) => selected[r.key] ?? r.status === "new";
  const categoryOf = (r: Row) => (r.key in categories ? categories[r.key] : r.suggested);
  const chosen = rows.filter(isSelected);
  const totals = chosen.reduce(
    (acc, r) => {
      if (r.type === "income") acc.income += r.amount;
      else acc.expense += r.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const counts = {
    imported: rows.filter((r) => r.status === "imported").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    internal: rows.filter((r) => r.status === "internal").length,
  };

  /* ------------------------------ ações ------------------------------ */
  async function onFile(file: File) {
    setError(null);
    setDone(null);
    setSelected({});
    setCategories({});
    try {
      const text = await readFileText(file);
      const res = parseStatement(text, file.name);
      if (!res.rows.length) {
        setError(res.warnings[0] ?? "Não encontrei lançamentos nesse arquivo.");
        setParsed(null);
        return;
      }
      setParsed(res);
      setFileName(file.name);
      setInvert(false);
      if (res.looksLikeCard && cards[0]) setDest({ kind: "card", id: cards[0].id });
      else if (!res.looksLikeCard && dest?.kind === "card" && accounts[0]) setDest({ kind: "account", id: accounts[0].id });
    } catch (err) {
      console.error(err);
      setError("Não consegui ler esse arquivo. Use OFX ou CSV.");
    }
  }

  async function doImport() {
    if (!dest || !chosen.length) return;
    setBusy(true);
    const learnedNext = { ...learned };
    const txs: Omit<Transaction, "id" | "createdAt" | "updatedAt">[] = chosen.map((r) => {
      const categoryId = categoryOf(r) ?? null;
      const k = descriptionKey(r.rawDescription);
      if (k && categoryId) learnedNext[k] = categoryId;
      return {
        type: r.type,
        description: r.description,
        amount: r.amount,
        date: r.date,
        categoryId,
        accountId: dest.kind === "account" ? dest.id : null,
        toAccountId: null,
        cardId: dest.kind === "card" ? dest.id : null,
        invoiceMonth: card ? (invoiceMode === "auto" ? invoiceMonthFor(card, r.date) : invoiceMode) : null,
        paid: true,
        installmentGroupId: null,
        installmentNumber: null,
        installmentTotal: null,
        recurrenceId: null,
        notes: "",
        externalId: r.externalId,
      };
    });
    saveLearned(learnedNext);
    const n = await importTransactions(txs);
    setBusy(false);
    setDone(n);
    setParsed(null);
    setFileName(null);
  }

  /* ------------------------------ telas ------------------------------ */
  if (done != null) {
    return (
      <>
        <PageHeader title="Importar extrato" />
        <Card className="mt-3">
          <Empty
            icon={<CircleCheck className="text-income" />}
            title={`${done} lançamentos importados`}
            text="Eles já aparecem nos lançamentos, no saldo e nas faturas."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/lancamentos">
                  <Button>Ver lançamentos</Button>
                </Link>
                <Button variant="secondary" onClick={() => setDone(null)}>
                  Importar outro
                </Button>
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const invoiceOptions = card
    ? Array.from({ length: 8 }, (_, i) => addMonths(invoiceMonthFor(card, todayISO()), i - 4))
    : [];

  return (
    <>
      <PageHeader title="Importar extrato" subtitle="OFX ou CSV do seu banco" />

      <input
        ref={fileRef}
        type="file"
        accept=".ofx,.csv,.txt,application/x-ofx,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-[360px_1fr]">
        <div>
          {/* arquivo */}
          <SectionTitle>1. Arquivo</SectionTitle>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface p-5 text-left transition hover:border-accent-text/50"
          >
            <span className="bg-brand grid size-12 shrink-0 place-items-center rounded-2xl text-white">
              <FileUp size={22} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{fileName ?? "Escolher arquivo"}</span>
              <span className="block text-xs text-muted">
                {parsed ? `${parsed.rows.length} lançamentos encontrados · toque para trocar` : "Extrato (OFX/CSV) ou fatura do cartão (CSV/OFX)"}
              </span>
            </span>
          </button>
          {error && <p className="mt-2 rounded-2xl bg-expense/10 px-3 py-2.5 text-sm text-expense">{error}</p>}

          {/* destino */}
          <SectionTitle>2. Onde lançar</SectionTitle>
          <Card className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <DestChip key={a.id} active={dest?.kind === "account" && dest.id === a.id} color={a.color} icon={<Wallet size={15} />} onClick={() => setDest({ kind: "account", id: a.id })}>
                  {a.name}
                </DestChip>
              ))}
              {cards.map((c) => (
                <DestChip key={c.id} active={dest?.kind === "card" && dest.id === c.id} color={c.color} icon={<CreditCard size={15} />} onClick={() => setDest({ kind: "card", id: c.id })}>
                  {c.name}
                </DestChip>
              ))}
            </div>
            {card && (
              <label className="block">
                <span className="mb-1.5 block px-1 text-xs font-semibold text-muted">Fatura</span>
                <select
                  className="h-11 w-full rounded-2xl border border-line bg-surface-2 px-3 text-sm outline-none"
                  value={invoiceMode}
                  onChange={(e) => setInvoiceMode(e.target.value)}
                >
                  <option value="auto">Automático (pela data e fechamento do cartão)</option>
                  {invoiceOptions.map((m) => (
                    <option key={m} value={m}>
                      Tudo na fatura de {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Toggle
              checked={invert}
              onChange={setInvert}
              label="Inverter entradas e saídas"
              description="Use se as compras aparecerem como receita"
            />
          </Card>

          <div className="mt-3 flex gap-2 rounded-2xl bg-surface px-3 py-3 text-xs text-muted">
            <Info size={16} className="mt-0.5 shrink-0 text-accent-text" />
            <p>
              <b className="text-fg">Nubank:</b> no app, em <b>Conta → Extrato</b> peça o extrato em OFX/CSV. Para o cartão, abra a fatura e
              exporte em CSV. Lançamentos já importados são ignorados automaticamente.
            </p>
          </div>
        </div>

        {/* prévia */}
        <div>
          <SectionTitle
            action={
              rows.length > 0 && (
                <div className="flex gap-3 text-xs font-semibold">
                  <button type="button" className="text-accent-text" onClick={() => setSelected(Object.fromEntries(rows.map((r) => [r.key, r.status !== "imported"])))}>
                    Marcar todos
                  </button>
                  <button type="button" className="text-muted" onClick={() => setSelected(Object.fromEntries(rows.map((r) => [r.key, false])))}>
                    Nenhum
                  </button>
                </div>
              )
            }
          >
            3. Conferir
          </SectionTitle>

          {!parsed ? (
            <Card>
              <Empty icon={<FileUp />} title="Nenhum arquivo ainda" text="Escolha o arquivo do extrato para ver a prévia aqui antes de importar." />
            </Card>
          ) : (
            <>
              {(counts.imported > 0 || counts.duplicate > 0 || counts.internal > 0) && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {counts.imported > 0 && <Badge>{counts.imported} já importados</Badge>}
                  {counts.duplicate > 0 && <Badge tone="warn">{counts.duplicate} parecem já lançados</Badge>}
                  {counts.internal > 0 && <Badge tone="accent">{counts.internal} pagamentos/transferências internas</Badge>}
                </div>
              )}
              <div className="space-y-2">
                {rows.map((r) => {
                  const sel = isSelected(r);
                  const catId = categoryOf(r);
                  const cat = data.categories.find((c) => c.id === catId);
                  return (
                    <div
                      key={r.key}
                      className={cx(
                        "rounded-3xl border bg-surface p-3 transition",
                        sel ? "border-accent-text/40" : "border-line opacity-55",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          aria-label={sel ? "Desmarcar" : "Marcar"}
                          onClick={() => setSelected((s) => ({ ...s, [r.key]: !sel }))}
                          className={cx(
                            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition",
                            sel ? "border-accent bg-accent text-white" : "border-faint",
                          )}
                        >
                          {sel && <Check size={14} strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold" title={r.rawDescription}>
                            {r.description}
                          </p>
                          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            {shortDate(r.date)}
                            {r.status === "imported" && <Badge>já importado</Badge>}
                            {r.status === "duplicate" && <Badge tone="warn">parece já lançado</Badge>}
                            {r.status === "internal" && <Badge tone="accent">pagamento/transferência</Badge>}
                          </p>
                        </div>
                        <Money
                          value={r.amount}
                          sign={r.type}
                          colored={r.type === "income"}
                          className="shrink-0 text-[15px] font-bold"
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2 pl-9">
                        <CategoryIcon icon={cat?.icon} color={cat?.color} size={26} />
                        <select
                          className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-2 text-sm outline-none"
                          value={catId ?? ""}
                          onChange={(e) => setCategories((c) => ({ ...c, [r.key]: e.target.value || null }))}
                        >
                          <option value="">Sem categoria</option>
                          {data.categories
                            .filter((c) => c.kind === r.type)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* barra de confirmação */}
      {parsed && (
        <div className="sticky bottom-20 z-30 mt-4 md:bottom-4">
          <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface/95 p-3 shadow-soft backdrop-blur">
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold text-fg">{chosen.length} selecionados</p>
              <p className="truncate text-muted">
                <Money value={totals.income} sign="income" colored /> · <Money value={totals.expense} sign="expense" />
              </p>
            </div>
            <Button size="lg" disabled={!chosen.length || busy || !dest} onClick={doImport}>
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Repeat size={18} />} Importar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function DestChip({
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
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition",
        active ? "border-accent-text/70 bg-surface-2 text-fg" : "border-line text-muted hover:bg-surface-2",
      )}
    >
      <span style={{ color }}>{icon}</span>
      {children}
    </button>
  );
}
