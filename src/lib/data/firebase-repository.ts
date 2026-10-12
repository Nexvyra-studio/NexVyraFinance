import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "../firebase/client";
import { COLLECTIONS, emptyData, type CollectionName, type DocOf, type FinanceData } from "../types";
import type { FinanceRepository } from "./repository";

/**
 * Persistência no Cloud Firestore.
 *
 * Estrutura: users/{uid}/{coleção}/{id}
 *   coleções: accounts, cards, categories, transactions, recurrences, invoices
 *
 * Cada documento tem exatamente os campos das interfaces em src/lib/types.ts
 * (o `id` também é gravado dentro do documento para facilitar consultas/exports).
 */
export class FirebaseRepository implements FinanceRepository {
  readonly kind = "firebase" as const;
  private db: Firestore;

  constructor(private uid: string) {
    this.db = getDb();
  }

  private col(name: CollectionName) {
    return collection(this.db, "users", this.uid, name);
  }

  async loadAll(): Promise<FinanceData> {
    const data = emptyData();
    await Promise.all(
      COLLECTIONS.map(async (name) => {
        const snap = await getDocs(this.col(name));
        (data[name] as unknown[]) = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      }),
    );
    return data;
  }

  /** Firestore aceita no máximo 500 operações por batch */
  private async commitInChunks(ops: ((b: ReturnType<typeof writeBatch>) => void)[]) {
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(this.db);
      ops.slice(i, i + 450).forEach((op) => op(batch));
      await batch.commit();
    }
  }

  async upsert<K extends CollectionName>(name: K, docs: DocOf<K>[]): Promise<void> {
    await this.commitInChunks(
      docs.map((d) => (b) => b.set(doc(this.col(name), d.id), stripUndefined(d))),
    );
  }

  async remove(name: CollectionName, ids: string[]): Promise<void> {
    await this.commitInChunks(ids.map((id) => (b) => b.delete(doc(this.col(name), id))));
  }

  async replaceAll(data: FinanceData): Promise<void> {
    const current = await this.loadAll();
    const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
    for (const name of COLLECTIONS) {
      const keep = new Set((data[name] as { id: string }[]).map((d) => d.id));
      for (const d of current[name] as { id: string }[]) {
        if (!keep.has(d.id)) ops.push((b) => b.delete(doc(this.col(name), d.id)));
      }
      for (const d of data[name] as { id: string }[]) {
        ops.push((b) => b.set(doc(this.col(name), d.id), stripUndefined(d)));
      }
    }
    await this.commitInChunks(ops);
  }
}

/** Firestore não aceita `undefined` */
function stripUndefined<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}
