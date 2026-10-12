import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./client";

/** Observa o usuário logado. Retorna a função para parar de observar. */
export function watchUser(cb: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const res = await signInWithPopup(getFirebaseAuth(), provider);
  return res.user;
}

export async function signInWithEmail(email: string, password: string) {
  const res = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return res.user;
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const res = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  if (name.trim()) await updateProfile(res.user, { displayName: name.trim() });
  return res.user;
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export function currentUser() {
  return getFirebaseAuth().currentUser;
}

export async function updateDisplayName(name: string) {
  const u = getFirebaseAuth().currentUser;
  if (!u) throw new Error("sem usuário");
  await updateProfile(u, { displayName: name.trim() });
  return u;
}

/** Troca a senha (só para contas de e-mail/senha). Pede a senha atual por segurança. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const u = getFirebaseAuth().currentUser;
  if (!u || !u.email) throw new Error("sem usuário");
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPassword));
  await updatePassword(u, newPassword);
}

export function signOutUser() {
  return signOut(getFirebaseAuth());
}

/** Traduz os erros mais comuns do Firebase Auth */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/missing-password": "Digite a senha.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Não existe conta com esse e-mail.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Tente entrar.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente de novo.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/cancelled-popup-request": "Login cancelado.",
    "auth/popup-blocked": "O navegador bloqueou a janela de login. Libere pop-ups e tente de novo.",
    "auth/unauthorized-domain": "Este endereço não está autorizado no Firebase (Authentication → Domínios autorizados).",
    "auth/operation-not-allowed": "Esse método de login não está ativado no Firebase.",
    "auth/requires-recent-login": "Por segurança, saia e entre de novo antes de fazer isso.",
    "auth/configuration-not-found": "O login ainda não foi ativado no Firebase (Authentication → Começar → Método de login).",
  };
  return map[code] ?? "Não foi possível concluir. Tente novamente.";
}
