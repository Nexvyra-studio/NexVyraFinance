/**
 * Inicialização do Firebase (preparada, mas só é usada quando
 * NEXT_PUBLIC_DATA_SOURCE=firebase). Preencha as variáveis no .env.local
 * — veja .env.example e docs/FIREBASE.md.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

import { firebaseConfig, isFirebaseConfigured } from "./config";

export { firebaseConfig, isFirebaseConfigured };

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase não configurado. Preencha as variáveis NEXT_PUBLIC_FIREBASE_* no .env.local");
  }
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    const a = getFirebaseApp();
    try {
      // cache offline: o app continua funcionando sem internet e sincroniza depois
      db = initializeFirestore(a, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      db = getFirestore(a);
    }
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}
