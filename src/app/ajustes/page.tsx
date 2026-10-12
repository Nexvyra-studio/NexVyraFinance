"use client";

import {
  ChevronRight, CloudUpload, CreditCard, Database, Download, LogOut, Moon, Plus, Repeat, Sparkles, Sun, Trash2, Upload, Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { CategoryIcon } from "@/components/category-icon";
import { AccountForm, CategoryForm, RecurrenceForm } from "@/components/forms";
import { usePrefs } from "@/components/prefs";
import { Badge, Button, Card, Confirm, Money, SectionTitle, Segmented, Toggle } from "@/components/ui";
import { monthLabel, todayISO } from "@/lib/dates";
import { accountBalance } from "@/lib/finance";
import type { Account, Category, CategoryKind, FinanceData, Recurrence } from "@/lib/types";
import { useFinance, useLookups } from "@/store/finance-store";

const ACCOUNT_TYPE: Record<string, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  carteira: "Carteira",
  investimento: "Investimento",
};

export default function AjustesPage() {
  const { data, source, user, replaceData, loadDemo, resetData, importLocalToFirebase, signOut, notify } = useFinance();
  const lk = useLookups();
  const { theme, setTheme, hideValues, toggleHideValues } = usePrefs();
  const [accountForm, setAccountForm] = useState<Account | "new" | null>(null);
  const [categoryForm, setCategoryForm] = useState<Category | "new" | null>(null);
  const [recForm, setRecForm] = useState<Recurrence | "new" | null>(null);
  const [catKind, setCatKind] = useState<CategoryKind>("expense");
  const [confirm, setConfirm] = useState<null | "demo" | "reset" | "import" | "migrate">(null);
  const [pendingImport, setPendingImport] = useState<FinanceData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: "nexvyra-finance", version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexvyra-finance-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const d = (json.data ?? json) as FinanceData;
      if (!Array.isArray(d.accounts) || !Array.isArray(d.transactions)) throw new Error("formato");
      setPendingImport(d);
      setConfirm("import");
    } catch {
      notify("Arquivo inválido");
    }
  };

  const accounts = data.accounts.slice().sort((a, b) => Number(a.archived) - Number(b.archived));
  const categories = data.categories.filter((c) => c.kind === catKind).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <>
      <PageHeader title="Ajustes" />

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <div>
          {/* contas */}
          <div id="contas" />
          <SectionTitle action={<AddLink onClick={() => setAccountForm("new")} />}>Contas</SectionTitle>
          <Card className="p-1.5">
            {accounts.map((a) => (
              <button key={a.id} type="button" onClick={() => setAccountForm(a)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2/60">
                <span className="grid size-10 place-items-center rounded-2xl" style={{ background: `${a.color}22`, color: a.color }}>
                  <Wallet size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="block text-xs text-muted">{ACCOUNT_TYPE[a.type]}</span>
                </span>
                {a.archived ? <Badge>arquivada</Badge> : <Money value={accountBalance(data, a.id)} className="font-semibold" />}
                <ChevronRight size={16} className="text-faint" />
              </button>
            ))}
          </Card>

          {/* cartões */}
          <SectionTitle>Cartões</SectionTitle>
          <Link href="/cartoes" className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 hover:bg-surface-2/50">
            <CreditCard size={20} className="text-muted" />
            <span className="flex-1 font-semibold">Gerenciar cartões e faturas</span>
            <span className="text-sm text-muted">{data.cards.filter((c) => !c.archived).length}</span>
            <ChevronRight size={16} className="text-faint" />
          </Link>

          {/* fixos */}
          <SectionTitle action={<AddLink onClick={() => setRecForm("new")} />}>Fixos mensais</SectionTitle>
          <Card className="p-1.5">
            {data.recurrences.length === 0 ? (
              <p className="px-3 py-5 text-center text-sm text-muted">
                Salário, aluguel, assinaturas... cadastre aqui o que se repete todo mês e o app já prevê no futuro.
              </p>
            ) : (
              data.recurrences
                .slice()
                .sort((a, b) => a.dayOfMonth - b.dayOfMonth)
                .map((r) => {
                  const c = lk.category(r.categoryId);
                  const where = r.cardId ? lk.card(r.cardId)?.name : lk.account(r.accountId)?.name;
                  return (
                    <button key={r.id} type="button" onClick={() => setRecForm(r)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2/60">
                      <CategoryIcon icon={c?.icon ?? "repeat"} color={c?.color} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.description}</span>
                        <span className="block truncate text-xs text-muted">
                          Todo dia {r.dayOfMonth} · {where ?? "—"}
                          {r.endMonth ? ` · até ${monthLabel(r.endMonth)}` : ""}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <Money value={r.amount} sign={r.type} colored={r.type === "income"} className="font-semibold" />
                        {!r.active && <Badge>pausado</Badge>}
                      </span>
                    </button>
                  );
                })
            )}
          </Card>

          {/* categorias */}
          <SectionTitle action={<AddLink onClick={() => setCategoryForm("new")} />}>Categorias</SectionTitle>
          <Card>
            <Segmented value={catKind} onChange={setCatKind} options={[{ value: "expense", label: "Despesas" }, { value: "income", label: "Receitas" }]} />
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {categories.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategoryForm(c)} className="flex flex-col items-center gap-1 rounded-2xl py-2 hover:bg-surface-2">
                  <CategoryIcon icon={c.icon} color={c.color} size={38} />
                  <span className="w-full truncate px-1 text-center text-[11px] font-medium text-muted">{c.name}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div>
          {/* aparência */}
          <SectionTitle>Aparência</SectionTitle>
          <Card className="space-y-2">
            <Segmented
              value={theme}
              onChange={setTheme}
              options={[
                { value: "dark", label: <span className="flex items-center justify-center gap-1.5"><Moon size={15} /> Escuro</span> },
                { value: "light", label: <span className="flex items-center justify-center gap-1.5"><Sun size={15} /> Claro</span> },
              ]}
            />
            <Toggle checked={hideValues} onChange={toggleHideValues} label="Esconder valores" description="Borra os valores na tela (bom para usar em público)" />
          </Card>

          {/* dados */}
          <SectionTitle>Dados</SectionTitle>
          <Card className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <Database size={20} className="text-muted" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{source === "firebase" ? "Firebase (nuvem)" : "Neste aparelho"}</p>
                <p className="truncate text-xs text-muted">
                  {source === "firebase"
                    ? user?.email ?? "Conectado"
                    : "Salvo no navegador. Configure o Firebase para sincronizar."}
                </p>
              </div>
              <Badge tone={source === "firebase" ? "income" : "muted"}>{source === "firebase" ? "nuvem" : "local"}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={exportJson}>
                <Download size={17} /> Exportar
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={17} /> Importar
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />

            {source === "firebase" && (
              <Button variant="secondary" className="w-full" onClick={() => setConfirm("migrate")}>
                <CloudUpload size={17} /> Enviar dados deste navegador para a nuvem
              </Button>
            )}

            <Button variant="secondary" className="w-full" onClick={() => setConfirm("demo")}>
              <Sparkles size={17} /> Carregar dados de exemplo
            </Button>
            <Button variant="danger" className="w-full" onClick={() => setConfirm("reset")}>
              <Trash2 size={17} /> Apagar tudo e começar do zero
            </Button>
            {source === "firebase" && (
              <Button variant="ghost" className="w-full" onClick={signOut}>
                <LogOut size={17} /> Sair
              </Button>
            )}
          </Card>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-faint">
            <Repeat size={12} /> NexVyra Finance · v1.0
          </div>
        </div>
      </div>

      {accountForm && <AccountForm account={accountForm === "new" ? undefined : accountForm} onClose={() => setAccountForm(null)} />}
      {categoryForm && (
        <CategoryForm category={categoryForm === "new" ? undefined : categoryForm} kind={catKind} onClose={() => setCategoryForm(null)} />
      )}
      {recForm && <RecurrenceForm recurrence={recForm === "new" ? undefined : recForm} onClose={() => setRecForm(null)} />}

      <Confirm
        open={confirm === "demo"}
        onClose={() => setConfirm(null)}
        title="Carregar exemplo?"
        message="Isso substitui todos os seus dados atuais por dados fictícios para teste. Exporte um backup antes se precisar."
        confirmLabel="Carregar exemplo"
        danger
        onConfirm={loadDemo}
      />
      <Confirm
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        title="Apagar tudo?"
        message="Todos os lançamentos, contas, cartões e fixos serão apagados. As categorias padrão são recriadas."
        confirmLabel="Apagar tudo"
        danger
        onConfirm={resetData}
      />
      <Confirm
        open={confirm === "import"}
        onClose={() => { setConfirm(null); setPendingImport(null); }}
        title="Importar backup?"
        message={`Os dados atuais serão substituídos pelo backup (${pendingImport?.transactions.length ?? 0} lançamentos).`}
        confirmLabel="Importar"
        danger
        onConfirm={async () => {
          if (pendingImport) {
            await replaceData(pendingImport);
            notify("Backup importado");
          }
        }}
      />
      <Confirm
        open={confirm === "migrate"}
        onClose={() => setConfirm(null)}
        title="Enviar dados locais?"
        message="Os dados salvos neste navegador (modo local) vão substituir os dados da nuvem."
        confirmLabel="Enviar"
        danger
        onConfirm={async () => {
          const ok = await importLocalToFirebase();
          if (!ok) notify("Nenhum dado local encontrado neste navegador");
        }}
      />
    </>
  );
}

function AddLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-xs font-semibold text-accent-text">
      <Plus size={14} /> Adicionar
    </button>
  );
}
