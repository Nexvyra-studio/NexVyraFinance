"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { currentMonth, monthLabel } from "@/lib/dates";
import type { Account, AccountType, CardBrand, Category, CategoryKind, CreditCard, Recurrence } from "@/lib/types";
import { useFinance } from "@/store/finance-store";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "./category-icon";
import { MoneyInput } from "./money-input";
import { Button, Confirm, Field, Segmented, Sheet, Toggle, cx, inputClass } from "./ui";

const ACCOUNT_COLORS = ["#2F7BFF", "#5BD69B", "#6BB8F5", "#B49BF5", "#F59E6B", "#F58FA8", "#5ED1E0", "#F7C55E"];
const CARD_COLORS = ["#8A5CF6", "#FF8A3D", "#1F2937", "#E11D48", "#0EA5E9", "#16A34A", "#D4AF37", "#64748B"];

function ColorPicker({ value, onChange, colors }: { value: string; onChange: (c: string) => void; colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Cor ${c}`}
          onClick={() => onChange(c)}
          className={cx("size-9 rounded-full border-2 transition", value === c ? "scale-110 border-fg" : "border-transparent")}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function DayInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={31}
      className={inputClass}
      value={value || ""}
      onChange={(e) => onChange(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
    />
  );
}

function DeleteFooter({ onSave, onDelete, canSave, deleteLabel }: { onSave: () => void; onDelete?: () => void; canSave: boolean; deleteLabel: string }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex gap-2">
      {onDelete && (
        <>
          <Button variant="danger" className="w-12 shrink-0 px-0" aria-label="Excluir" onClick={() => setConfirm(true)}>
            <Trash2 size={18} />
          </Button>
          <Confirm open={confirm} onClose={() => setConfirm(false)} title={deleteLabel} danger confirmLabel="Excluir" onConfirm={onDelete} />
        </>
      )}
      <Button size="lg" className="flex-1" disabled={!canSave} onClick={onSave}>
        Salvar
      </Button>
    </div>
  );
}

/* --------------------------------- Conta --------------------------------- */

export function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { saveAccount, deleteAccount } = useFinance();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "corrente");
  const [initialBalance, setInitial] = useState(account?.initialBalance ?? 0);
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[0]);
  const [archived, setArchived] = useState(account?.archived ?? false);

  const save = async () => {
    await saveAccount({ ...(account ?? {}), name: name.trim(), type, initialBalance, color, archived });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={account ? "Editar conta" : "Nova conta"}
      footer={
        <DeleteFooter
          canSave={!!name.trim()}
          onSave={save}
          deleteLabel="Excluir conta? Se tiver lançamentos, ela será arquivada."
          onDelete={account ? async () => { await deleteAccount(account.id); onClose(); } : undefined}
        />
      }
    >
      <div className="space-y-4">
        <Field label="Nome">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Itaú, Carteira" autoFocus={!account} />
        </Field>
        <Field label="Tipo" group>
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: "corrente", label: "Corrente" },
              { value: "poupanca", label: "Poupança" },
              { value: "carteira", label: "Carteira" },
              { value: "investimento", label: "Invest." },
            ]}
          />
        </Field>
        <Field label="Saldo inicial" hint="Quanto tinha nessa conta quando começou a usar o app. Pode ser negativo (±).">
          <MoneyInput value={initialBalance} onChange={setInitial} allowNegative />
        </Field>
        <Field label="Cor" group>
          <ColorPicker value={color} onChange={setColor} colors={ACCOUNT_COLORS} />
        </Field>
        {account && <Toggle checked={archived} onChange={setArchived} label="Arquivada" description="Some das listas e não entra no saldo" />}
      </div>
    </Sheet>
  );
}

/* --------------------------------- Cartão -------------------------------- */

export function CardForm({ card, onClose }: { card?: CreditCard; onClose: () => void }) {
  const { data, saveCard, deleteCard } = useFinance();
  const [name, setName] = useState(card?.name ?? "");
  const [brand, setBrand] = useState<CardBrand>(card?.brand ?? "mastercard");
  const [limit, setLimit] = useState(card?.limit ?? 0);
  const [closingDay, setClosing] = useState(card?.closingDay ?? 1);
  const [dueDay, setDue] = useState(card?.dueDay ?? 10);
  const [color, setColor] = useState(card?.color ?? CARD_COLORS[0]);
  const [paymentAccountId, setPayAcc] = useState<string | null>(card?.paymentAccountId ?? data.accounts[0]?.id ?? null);
  const [archived, setArchived] = useState(card?.archived ?? false);

  const save = async () => {
    await saveCard({ ...(card ?? {}), name: name.trim(), brand, limit, closingDay, dueDay, color, paymentAccountId, archived });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={card ? "Editar cartão" : "Novo cartão"}
      footer={
        <DeleteFooter
          canSave={!!name.trim()}
          onSave={save}
          deleteLabel="Excluir cartão? Se tiver compras, ele será arquivado."
          onDelete={card ? async () => { await deleteCard(card.id); onClose(); } : undefined}
        />
      }
    >
      <div className="space-y-4">
        <div className="relative h-36 overflow-hidden rounded-3xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}99 60%, #00000066)` }}>
          <p className="text-lg font-bold drop-shadow">{name || "Meu cartão"}</p>
          <p className="absolute bottom-4 left-4 text-xs font-semibold uppercase tracking-widest opacity-80">{brand}</p>
          <p className="absolute bottom-4 right-4 text-xs font-semibold opacity-80">fecha {closingDay} · vence {dueDay}</p>
        </div>
        <Field label="Nome">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank, Inter" autoFocus={!card} />
        </Field>
        <Field label="Bandeira">
          <select className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value as CardBrand)}>
            <option value="mastercard">Mastercard</option>
            <option value="visa">Visa</option>
            <option value="elo">Elo</option>
            <option value="amex">Amex</option>
            <option value="hipercard">Hipercard</option>
            <option value="outro">Outro</option>
          </select>
        </Field>
        <Field label="Limite">
          <MoneyInput value={limit} onChange={setLimit} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia que fecha">
            <DayInput value={closingDay} onChange={setClosing} />
          </Field>
          <Field label="Dia que vence">
            <DayInput value={dueDay} onChange={setDue} />
          </Field>
        </div>
        <Field label="Pagar fatura com">
          <select className={inputClass} value={paymentAccountId ?? ""} onChange={(e) => setPayAcc(e.target.value || null)}>
            <option value="">—</option>
            {data.accounts.filter((a) => !a.archived).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Cor" group>
          <ColorPicker value={color} onChange={setColor} colors={CARD_COLORS} />
        </Field>
        {card && <Toggle checked={archived} onChange={setArchived} label="Arquivado" description="Some das listas" />}
      </div>
    </Sheet>
  );
}

/* -------------------------------- Categoria ------------------------------- */

export function CategoryForm({ category, kind, onClose }: { category?: Category; kind?: CategoryKind; onClose: () => void }) {
  const { saveCategory, deleteCategory } = useFinance();
  const [name, setName] = useState(category?.name ?? "");
  const [k, setK] = useState<CategoryKind>(category?.kind ?? kind ?? "expense");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? "dots");

  const save = async () => {
    await saveCategory({ ...(category ?? {}), name: name.trim(), kind: k, color, icon });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={category ? "Editar categoria" : "Nova categoria"}
      footer={
        <DeleteFooter
          canSave={!!name.trim()}
          onSave={save}
          deleteLabel="Excluir categoria? Os lançamentos ficam sem categoria."
          onDelete={category ? async () => { await deleteCategory(category.id); onClose(); } : undefined}
        />
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={icon} color={color} size={52} />
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria" autoFocus={!category} />
        </div>
        <Segmented value={k} onChange={setK} options={[{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }]} />
        <Field label="Cor" group>
          <ColorPicker value={color} onChange={setColor} colors={CATEGORY_COLORS} />
        </Field>
        <Field label="Ícone" group>
          <div className="grid grid-cols-7 gap-2">
            {Object.keys(CATEGORY_ICONS).map((key) => (
              <button key={key} type="button" onClick={() => setIcon(key)} className={cx("rounded-2xl p-0.5 transition", icon === key ? "ring-2 ring-fg" : "")}>
                <CategoryIcon icon={key} color={icon === key ? color : "#8b919c"} size={38} />
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

/* ------------------------------ Fixo mensal ------------------------------- */

export function RecurrenceForm({ recurrence, onClose }: { recurrence?: Recurrence; onClose: () => void }) {
  const { data, saveRecurrence, deleteRecurrence } = useFinance();
  const [type, setType] = useState<"income" | "expense">(recurrence?.type ?? "expense");
  const [description, setDescription] = useState(recurrence?.description ?? "");
  const [amount, setAmount] = useState(recurrence?.amount ?? 0);
  const [dayOfMonth, setDay] = useState(recurrence?.dayOfMonth ?? 10);
  const [categoryId, setCategoryId] = useState<string | null>(recurrence?.categoryId ?? null);
  const [source, setSource] = useState<string>(
    recurrence?.cardId ? `card:${recurrence.cardId}` : `acc:${recurrence?.accountId ?? data.accounts[0]?.id ?? ""}`,
  );
  const [startMonth, setStart] = useState(recurrence?.startMonth ?? currentMonth());
  const [endMonth, setEnd] = useState<string | null>(recurrence?.endMonth ?? null);
  const [active, setActive] = useState(recurrence?.active ?? true);

  const [kind, id] = source.split(":");
  const save = async () => {
    await saveRecurrence({
      ...(recurrence ?? { skippedMonths: [] }),
      type,
      description: description.trim(),
      amount,
      dayOfMonth,
      categoryId,
      accountId: kind === "acc" ? id || null : null,
      cardId: kind === "card" && type === "expense" ? id : null,
      startMonth,
      endMonth,
      active,
      skippedMonths: recurrence?.skippedMonths ?? [],
    });
    onClose();
  };

  const cats = data.categories.filter((c) => c.kind === type);

  return (
    <Sheet
      open
      onClose={onClose}
      title={recurrence ? "Editar fixo" : "Novo fixo mensal"}
      footer={
        <DeleteFooter
          canSave={!!description.trim() && amount > 0}
          onSave={save}
          deleteLabel="Excluir fixo? Os lançamentos já confirmados continuam."
          onDelete={recurrence ? async () => { await deleteRecurrence(recurrence.id); onClose(); } : undefined}
        />
      }
    >
      <div className="space-y-4">
        <Segmented
          value={type}
          onChange={(t) => { setType(t); setCategoryId(null); if (t === "income" && kind === "card") setSource(`acc:${data.accounts[0]?.id ?? ""}`); }}
          options={[
            { value: "expense", label: "Despesa", activeClass: "bg-expense/15 text-expense" },
            { value: "income", label: "Receita", activeClass: "bg-income/15 text-income" },
          ]}
        />
        <Field label="Descrição">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aluguel, Salário, Netflix" />
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Valor">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Dia">
            <DayInput value={dayOfMonth} onChange={setDay} />
          </Field>
        </div>
        <Field label={type === "income" ? "Receber em" : "Pagar com"}>
          <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)}>
            {data.accounts.filter((a) => !a.archived).map((a) => (
              <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>
            ))}
            {type === "expense" &&
              data.cards.filter((c) => !c.archived).map((c) => (
                <option key={c.id} value={`card:${c.id}`}>Cartão {c.name}</option>
              ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select className={inputClass} value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value || null)}>
            <option value="">Sem categoria</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Começa em">
            <input type="month" className={inputClass} value={startMonth} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </Field>
          <Field label="Termina em" hint={endMonth ? undefined : "Sem fim"}>
            <input type="month" className={inputClass} value={endMonth ?? ""} onChange={(e) => setEnd(e.target.value || null)} />
          </Field>
        </div>
        <Toggle checked={active} onChange={setActive} label="Ativo" description={active ? "Aparece como previsto todo mês" : "Pausado"} />
        {recurrence?.skippedMonths?.length ? (
          <p className="px-1 text-xs text-muted">Meses pulados: {recurrence.skippedMonths.map((m) => monthLabel(m)).join(", ")}</p>
        ) : null}
      </div>
    </Sheet>
  );
}
