import type { CollectionName, DocOf, FinanceData } from "../types";

/**
 * Contrato de persistência. O app inteiro conversa só com essa interface,
 * então trocar de localStorage para Firebase é só mudar a implementação
 * (ver src/lib/data/index.ts e a variável NEXT_PUBLIC_DATA_SOURCE).
 */
export interface FinanceRepository {
  readonly kind: "local" | "firebase";
  loadAll(): Promise<FinanceData>;
  upsert<K extends CollectionName>(col: K, docs: DocOf<K>[]): Promise<void>;
  remove(col: CollectionName, ids: string[]): Promise<void>;
  /** substitui todos os dados (importar backup / limpar) */
  replaceAll(data: FinanceData): Promise<void>;
}
