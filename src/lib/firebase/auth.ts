import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
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

export function signOutUser() {
  return signOut(getFirebaseAuth());
}
