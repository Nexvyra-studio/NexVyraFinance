import { COLLECTIONS, emptyData, type CollectionName, type DocOf, type FinanceData } from "../types";
import type { FinanceRepository } from "./repository";

export const LOCAL_STORAGE_KEY = "nexvyra-finance:data:v1";

/** Lê os dados salvos no navegador (também usado para migrar para o Firebase) */
export function readLocalData(): FinanceData | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FinanceData>;
    const data = emptyData();
    for (const c of COLLECTIONS) {
      if (Array.isArray(parsed[c])) (data[c] as unknown[]) = parsed[c] as unknown[];
    }
    return data;
  } catch {
    return null;
  }
}

/** Persistência local (localStorage). Funciona offline e sem configurar nada. */
export class LocalRepository implements FinanceRepository {
  readonly kind = "local" as const;
  private data: FinanceData = emptyData();

  async loadAll(): Promise<FinanceData> {
    this.data = readLocalData() ?? emptyData();
    return structuredClone(this.data);
  }

  private persist() {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.error("[NexVyra] Falha ao salvar no navegador", err);
    }
  }

  async upsert<K extends CollectionName>(col: K, docs: DocOf<K>[]): Promise<void> {
    const list = this.data[col] as DocOf<K>[];
    for (const doc of docs) {
      const i = list.findIndex((d) => d.id === doc.id);
      if (i >= 0) list[i] = doc;
      else list.push(doc);
    }
    this.persist();
  }

  async remove(col: CollectionName, ids: string[]): Promise<void> {
    const set = new Set(ids);
    (this.data[col] as { id: string }[]) = (this.data[col] as { id: string }[]).filter(
      (d) => !set.has(d.id),
    );
    this.persist();
  }

  async replaceAll(data: FinanceData): Promise<void> {
    this.data = structuredClone(data);
    this.persist();
  }
}
