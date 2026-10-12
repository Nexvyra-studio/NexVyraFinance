"use client";

import { ArrowLeftRight, ChevronRight, KeyRound, LogOut, Mail, Pencil, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { Badge, Button, Card, Confirm, Empty, Field, SectionTitle, Sheet, inputClass } from "@/components/ui";
import { useFinance } from "@/store/finance-store";

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PerfilPage() {
  const { user, source, data, signOut } = useFinance();
  const [editName, setEditName] = useState(false);
  const [changePass, setChangePass] = useState(false);
  const [confirm, setConfirm] = useState<null | "switch" | "logout">(null);

  if (source !== "firebase" || !user) {
    return (
      <>
        <PageHeader title="Perfil" />
        <Card className="mt-3">
          <Empty
            icon={<Wallet />}
            title="Modo local (sem login)"
            text="Os dados estão salvos só neste navegador. Para ter login, perfis e usar com outras pessoas, ative o Firebase (NEXT_PUBLIC_DATA_SOURCE=firebase)."
          />
        </Card>
      </>
    );
  }

  const isGoogle = user.providers.includes("google.com");
  const isPassword = user.providers.includes("password");

  return (
    <>
      <PageHeader title="Perfil" />

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <div>
          <section className="relative mt-3 overflow-hidden rounded-[28px] border border-line bg-surface p-5">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <UserAvatar user={user} size={68} className="ring-4 ring-accent/25" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-extrabold">{user.name || "Sem nome"}</p>
                <p className="truncate text-sm text-muted">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {isGoogle && <Badge tone="accent">Google</Badge>}
                  {isPassword && <Badge tone="accent">E-mail e senha</Badge>}
                </div>
              </div>
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
              <Stat label="Contas" value={data.accounts.filter((a) => !a.archived).length} />
              <Stat label="Cartões" value={data.cards.filter((c) => !c.archived).length} />
              <Stat label="Lançamentos" value={data.transactions.length} />
            </div>
          </section>

          <SectionTitle>Dados da conta</SectionTitle>
          <Card className="p-1.5">
            <Row icon={<Pencil size={18} />} label="Nome" value={user.name || "Adicionar nome"} onClick={() => setEditName(true)} />
            <Row icon={<Mail size={18} />} label="E-mail" value={user.email ?? "—"} />
            {isPassword ? (
              <Row icon={<KeyRound size={18} />} label="Senha" value="Trocar senha" onClick={() => setChangePass(true)} />
            ) : (
              <Row icon={<KeyRound size={18} />} label="Senha" value="Gerenciada pelo Google" />
            )}
          </Card>
          <p className="mt-2 px-2 text-xs text-faint">
            Membro desde {fmtDate(user.createdAt)} · último acesso {fmtDate(user.lastLoginAt)}
          </p>
        </div>

        <div>
          <SectionTitle>Sessão</SectionTitle>
          <Card className="space-y-2">
            <Button variant="secondary" size="lg" className="w-full" onClick={() => setConfirm("switch")}>
              <ArrowLeftRight size={18} /> Trocar de conta
            </Button>
            <Button variant="danger" size="lg" className="w-full" onClick={() => setConfirm("logout")}>
              <LogOut size={18} /> Sair
            </Button>
          </Card>

          <SectionTitle>Privacidade</SectionTitle>
          <Card className="flex gap-3">
            <ShieldCheck size={22} className="mt-0.5 shrink-0 text-income" />
            <p className="text-sm text-muted">
              Seus dados ficam guardados na sua área do banco e só a sua conta consegue ler ou alterar. Outras pessoas que usam o
              NexVyra não veem nada seu.
            </p>
          </Card>

          <Link href="/ajustes" className="mt-3 flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 hover:bg-surface-2/50">
            <span className="flex-1 font-semibold">Ajustes do app</span>
            <span className="hidden text-sm text-muted sm:inline">contas, categorias, backup</span>
            <ChevronRight size={16} className="text-faint" />
          </Link>
        </div>
      </div>

      {editName && <NameSheet initial={user.name ?? ""} onClose={() => setEditName(false)} />}
      {changePass && <PasswordSheet onClose={() => setChangePass(false)} />}
      <Confirm
        open={confirm === "switch"}
        onClose={() => setConfirm(null)}
        title="Trocar de conta?"
        message="Você vai sair desta conta e voltar para a tela de login para entrar com outra. Seus dados continuam salvos."
        confirmLabel="Trocar de conta"
        onConfirm={signOut}
      />
      <Confirm
        open={confirm === "logout"}
        onClose={() => setConfirm(null)}
        title="Sair da conta?"
        message="Seus dados continuam salvos na nuvem. É só entrar de novo para ver tudo."
        confirmLabel="Sair"
        danger
        onConfirm={signOut}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-2.5">
      <p className="num text-lg font-extrabold">{value}</p>
      <p className="text-[11px] font-semibold text-muted">{label}</p>
    </div>
  );
}

function Row({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted">{label}</span>
        <span className="block truncate font-semibold">{value}</span>
      </span>
      {onClick && <ChevronRight size={16} className="text-faint" />}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2/60">
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-2 py-2.5">{content}</div>
  );
}

function NameSheet({ initial, onClose }: { initial: string; onClose: () => void }) {
  const { updateName, notify } = useFinance();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open
      onClose={onClose}
      title="Seu nome"
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={!name.trim() || busy}
          onClick={async () => {
            setBusy(true);
            const err = await updateName(name);
            setBusy(false);
            if (err) setError(err);
            else {
              notify("Nome atualizado");
              onClose();
            }
          }}
        >
          Salvar
        </Button>
      }
    >
      <Field label="Nome">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
      </Field>
      {error && <p className="mt-3 text-sm text-expense">{error}</p>}
    </Sheet>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const { changePassword, notify } = useFinance();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Trocar senha"
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={!current || next.length < 6 || next !== confirm || busy}
          onClick={async () => {
            setBusy(true);
            const err = await changePassword(current, next);
            setBusy(false);
            if (err) setError(err);
            else {
              notify("Senha alterada");
              onClose();
            }
          }}
        >
          Salvar nova senha
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Senha atual">
          <input type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="Nova senha" hint="Mínimo de 6 caracteres">
          <input type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Repita a nova senha">
          <input type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {mismatch && <p className="text-sm text-warn">As senhas não são iguais.</p>}
        {error && <p className="text-sm text-expense">{error}</p>}
      </div>
    </Sheet>
  );
}
