"use client";

import { Eye, EyeOff, LoaderCircle, Lock, Mail, User } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useFinance } from "@/store/finance-store";
import { Logo } from "./logo";
import { Button, Segmented, cx } from "./ui";

type Mode = "login" | "signup" | "reset";

/** Tela de entrar / criar conta (só aparece no modo Firebase) */
export function AuthScreen() {
  const { signIn, resetPassword } = useFinance();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === "reset") {
      const err = await resetPassword(email);
      if (err) setError(err);
      else setInfo("Enviamos um link para redefinir a senha. Confira seu e-mail (e a caixa de spam).");
    } else {
      const err = await signIn(
        mode === "login" ? { kind: "email", email, password } : { kind: "signup", name, email, password },
      );
      if (err) setError(err);
    }
    setBusy(false);
  }

  async function google() {
    setBusy(true);
    setError(null);
    const err = await signIn({ kind: "google" });
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center">
          <Logo big />
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signup"
            ? "Crie sua conta. Seus dados ficam só com você."
            : mode === "reset"
              ? "Informe seu e-mail para receber o link de nova senha."
              : "Entre para acessar suas finanças."}
        </p>

        <div className="mt-6 rounded-[28px] border border-line bg-surface/90 p-5 shadow-soft backdrop-blur">
          {mode !== "reset" && (
            <Segmented
              value={mode}
              onChange={switchMode}
              options={[
                { value: "login", label: "Entrar" },
                { value: "signup", label: "Criar conta" },
              ]}
            />
          )}

          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "signup" && (
              <AuthInput icon={<User size={18} />}>
                <input
                  className="h-full w-full bg-transparent outline-none placeholder:text-faint"
                  placeholder="Seu nome"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </AuthInput>
            )}
            <AuthInput icon={<Mail size={18} />}>
              <input
                className="h-full w-full bg-transparent outline-none placeholder:text-faint"
                placeholder="E-mail"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </AuthInput>
            {mode !== "reset" && (
              <AuthInput icon={<Lock size={18} />}>
                <input
                  className="h-full w-full bg-transparent outline-none placeholder:text-faint"
                  placeholder={mode === "signup" ? "Crie uma senha (mín. 6)" : "Senha"}
                  type={showPass ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" aria-label={showPass ? "Esconder senha" : "Mostrar senha"} onClick={() => setShowPass((v) => !v)} className="text-faint hover:text-fg">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </AuthInput>
            )}

            {error && <p className="rounded-2xl bg-expense/10 px-3 py-2.5 text-sm font-medium text-expense">{error}</p>}
            {info && <p className="rounded-2xl bg-income/10 px-3 py-2.5 text-sm font-medium text-income">{info}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" size={20} /> : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
            </Button>
          </form>

          {mode === "login" && (
            <button type="button" onClick={() => switchMode("reset")} className="mt-3 w-full text-center text-sm font-semibold text-accent-text">
              Esqueci minha senha
            </button>
          )}
          {mode === "reset" && (
            <button type="button" onClick={() => switchMode("login")} className="mt-3 w-full text-center text-sm font-semibold text-accent-text">
              Voltar para o login
            </button>
          )}

          {mode !== "reset" && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-faint">
                <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="secondary" size="lg" className="w-full" disabled={busy} onClick={google}>
                <GoogleIcon /> Continuar com Google
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthInput({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <label className={cx("flex h-12 items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 text-[15px] transition focus-within:border-accent-text/60")}>
      <span className="text-faint">{icon}</span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
