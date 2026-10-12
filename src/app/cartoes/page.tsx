"use client";

import { ChevronLeft, ChevronRight, CreditCard, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { EntryRow } from "@/components/entry-row";
import { CardForm } from "@/components/forms";
import { InvoiceBadge } from "@/components/invoice-badge";
import { MoneyInput } from "@/components/money-input";
import { useSheets } from "@/components/sheets";
import { Button, Card, Confirm, Empty, Field, IconButton, Money, Progress, SectionTitle, Sheet, cx, inputClass } from "@/components/ui";
import { addMonths, dayLabel, monthLabel, monthShort, shortDate } from "@/lib/dates";
import { buildEntries, cardUsage, currentInvoiceMonth, invoiceInfo, type InvoiceInfo } from "@/lib/finance";
import type { CreditCard as Card_ } from "@/lib/types";
import { useFinance } from "@/store/finance-store";

export default function CartoesPage() {
  const { data } = useFinance();
  const cards = data.cards.filter((c) => !c.archived);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formCard, setFormCard] = useState<Card_ | "new" | null>(null);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o #id vindo do link do início
    if (fromHash) setSelectedId(fromHash);
  }, []);

  const selected = cards.find((c) => c.id === selectedId) ?? cards[0];

  return (
    <>
      <PageHeader
        title="Cartões"
        actions={
          <IconButton label="Novo cartão" onClick={() => setFormCard("new")}>
            <Plus size={22} />
          </IconButton>
        }
      />

      {cards.length === 0 ? (
        <Card className="mt-3">
          <Empty
            icon={<CreditCard />}
            title="Nenhum cartão cadastrado"
            text="Adicione seu cartão com o dia de fechamento e vencimento para o app calcular as faturas sozinho."
            action={<Button onClick={() => setFormCard("new")}>Adicionar cartão</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="no-scrollbar -mx-4 mt-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            {cards.map((c) => (
              <CardVisual key={c.id} card={c} active={c.id === selected?.id} onClick={() => setSelectedId(c.id)} />
            ))}
          </div>
          {selected && <CardDetail key={selected.id} card={selected} onEdit={() => setFormCard(selected)} />}
        </>
      )}

      {formCard && <CardForm card={formCard === "new" ? undefined : formCard} onClose={() => setFormCard(null)} />}
    </>
  );
}

function CardVisual({ card, active, onClick }: { card: Card_; active: boolean; onClick: () => void }) {
  const { data } = useFinance();
  const usage = useMemo(() => cardUsage(card, data, buildEntries(data, addMonths(currentInvoiceMonth(card), 1))), [card, data]);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "relative flex h-48 w-[82%] shrink-0 snap-center flex-col items-start justify-start overflow-hidden rounded-[26px] p-5 text-left text-white transition md:w-auto",
        active ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : "opacity-70 hover:opacity-100",
      )}
      style={{ background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}aa 55%, #00000088 100%)` }}
    >
      <div className="absolute -right-10 -top-14 size-44 rounded-full bg-white/10" />
      <div className="absolute -bottom-20 right-10 size-44 rounded-full bg-white/5" />
      <p className="relative text-lg font-bold drop-shadow">{card.name}</p>
      <p className="relative text-xs font-semibold opacity-80">fecha dia {card.closingDay} · vence dia {card.dueDay}</p>
      <div className="absolute inset-x-5 bottom-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-75">Disponível</p>
        <div className="flex items-end justify-between">
          <Money value={usage.available} className="text-xl font-extrabold drop-shadow" />
          <span className="text-xs font-bold uppercase tracking-widest opacity-80">{card.brand}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${usage.pct * 100}%` }} />
        </div>
      </div>
    </button>
  );
}

function CardDetail({ card, onEdit }: { card: Card_; onEdit: () => void }) {
  const { data, reopenInvoice } = useFinance();
  const { openNew } = useSheets();
  const [month, setMonth] = useState(() => currentInvoiceMonth(card));
  const [paying, setPaying] = useState<InvoiceInfo | null>(null);
  const [confirmReopen, setConfirmReopen] = useState(false);

  const { info, usage, timeline } = useMemo(() => {
    const until = addMonths(month > currentInvoiceMonth(card) ? month : currentInvoiceMonth(card), 12);
    const entries = buildEntries(data, until);
    const start = currentInvoiceMonth(card);
    const timeline = Array.from({ length: 6 }, (_, i) => invoiceInfo(card, addMonths(start, i), entries, data.invoices));
    return { info: invoiceInfo(card, month, entries, data.invoices), usage: cardUsage(card, data, entries), timeline };
  }, [card, data, month]);

  const maxTimeline = Math.max(1, ...timeline.map((t) => t.total));
  const payAccount = data.accounts.find((a) => a.id === info.record?.accountId);

  return (
    <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-[1fr_1fr]">
      <div>
        <SectionTitle
          action={
            <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs font-semibold text-accent-text">
              <Pencil size={13} /> Editar cartão
            </button>
          }
        >
          Limite
        </SectionTitle>
        <Card>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs font-semibold text-muted">Usado</p>
              <Money value={usage.used} className="text-lg font-bold" />
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-muted">Limite</p>
              <Money value={card.limit} className="text-lg font-bold" />
            </div>
          </div>
          <Progress value={usage.pct} color={card.color} className="mt-3" />
          <p className="mt-2 text-xs text-muted">
            Disponível <Money value={usage.available} className="font-semibold text-fg" /> · {Math.round(usage.pct * 100)}% usado (inclui parcelas futuras)
          </p>
        </Card>

        <SectionTitle>Próximas faturas</SectionTitle>
        <Card>
          <div className="flex h-36 items-end gap-2">
            {timeline.map((t) => {
              const h = t.total > 0 ? Math.max(6, (t.total / maxTimeline) * 100) : 3;
              return (
                <button key={t.month} type="button" onClick={() => setMonth(t.month)} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${monthLabel(t.month)}`}>
                  <span className={cx("num text-[10px] font-semibold", t.month === month ? "text-fg" : "text-faint")}>
                    <span className="sensitive">{t.total > 0 ? (t.total / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "–"}</span>
                  </span>
                  <span
                    className="w-full max-w-10 rounded-t-[4px] rounded-b-[2px] transition group-hover:opacity-100"
                    style={{ height: `${h}%`, background: t.month === month ? card.color : "var(--surface-3)" }}
                  />
                  <span className={cx("text-[11px] font-semibold capitalize", t.month === month ? "text-fg" : "text-muted")}>{monthShort(t.month)}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Fatura</SectionTitle>
        <Card>
          <div className="flex items-center justify-between">
            <IconButton label="Fatura anterior" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft size={20} />
            </IconButton>
            <div className="text-center">
              <p className="font-bold">{monthLabel(month)}</p>
              <InvoiceBadge status={info.status} />
            </div>
            <IconButton label="Próxima fatura" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight size={20} />
            </IconButton>
          </div>
          <Money value={info.record?.paid ? info.record.paidAmount : info.total} className="mt-3 block text-center text-[34px] font-extrabold" />
          <p className="text-center text-xs text-muted">
            Fecha {shortDate(info.closingDate)} · Vence {shortDate(info.dueDate)} ({dayLabel(info.dueDate).toLowerCase()})
          </p>
          {info.record?.paid && (
            <p className="mt-1 text-center text-xs text-income">
              Paga em {shortDate(info.record.paidAt!.slice(0, 10))}
              {payAccount ? ` com ${payAccount.name}` : ""}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            {info.record?.paid ? (
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmReopen(true)}>
                Desfazer pagamento
              </Button>
            ) : (
              <Button className="flex-1" disabled={info.total <= 0} onClick={() => setPaying(info)}>
                Pagar fatura
              </Button>
            )}
            <Button variant="secondary" onClick={() => openNew({ type: "expense", cardId: card.id })}>
              <Plus size={18} /> Compra
            </Button>
          </div>
        </Card>

        <SectionTitle action={<span className="text-xs text-muted">{info.items.length} itens</span>}>Compras da fatura</SectionTitle>
        <Card className="p-1.5">
          {info.items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Nenhuma compra nesta fatura.</p>
          ) : (
            info.items.map((e) => <EntryRow key={e.id} entry={e} showDate />)
          )}
        </Card>
      </div>

      {paying && <PayInvoiceSheet card={card} info={paying} onClose={() => setPaying(null)} />}
      <Confirm
        open={confirmReopen}
        onClose={() => setConfirmReopen(false)}
        title="Desfazer pagamento?"
        message="O valor volta para o saldo da conta e a fatura fica em aberto novamente."
        confirmLabel="Desfazer"
        onConfirm={() => reopenInvoice(card.id, month)}
      />
    </div>
  );
}

function PayInvoiceSheet({ card, info, onClose }: { card: Card_; info: InvoiceInfo; onClose: () => void }) {
  const { data, payInvoice } = useFinance();
  const [amount, setAmount] = useState(info.total);
  const [accountId, setAccountId] = useState<string | null>(card.paymentAccountId ?? data.accounts[0]?.id ?? null);

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Pagar fatura ${card.name}`}
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={amount <= 0}
          onClick={async () => {
            await payInvoice(card.id, info.month, amount, accountId);
            onClose();
          }}
        >
          Confirmar pagamento
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">Fatura de {monthLabel(info.month)} · vence {shortDate(info.dueDate)}</p>
        <Field label="Valor pago">
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>
        <Field label="Debitar da conta" hint="O valor sai do saldo dessa conta.">
          <select className={inputClass} value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value || null)}>
            {data.accounts.filter((a) => !a.archived).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
      </div>
    </Sheet>
  );
}
