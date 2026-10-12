import { LocalRepository } from "./local-repository";
import type { FinanceRepository } from "./repository";

export type DataSource = "local" | "firebase";

/**
 * Fonte de dados escolhida pelo .env.local:
 *   NEXT_PUBLIC_DATA_SOURCE=local     -> salva no navegador (padrão)
 *   NEXT_PUBLIC_DATA_SOURCE=firebase  -> Cloud Firestore + login Google
 */
export const DATA_SOURCE: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "firebase" ? "firebase" : "local";

export function createLocalRepository(): FinanceRepository {
  return new LocalRepository();
}

/** Import dinâmico: o SDK do Firebase só é baixado quando realmente usado */
export async function createFirebaseRepository(uid: string): Promise<FinanceRepository> {
  const { FirebaseRepository } = await import("./firebase-repository");
  return new FirebaseRepository(uid);
}
