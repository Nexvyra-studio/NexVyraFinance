/**
 * Importação de extratos bancários (OFX e CSV).
 *
 * Formatos testados/conhecidos:
 *  - OFX (padrão de quase todos os bancos, inclusive Nubank conta e cartão)
 *  - CSV fatura Nubank:  date,title,amount            (gasto = valor positivo)
 *  - CSV conta Nubank:   Data,Valor,Identificador,Descrição  (saída = valor negativo)
 *  - CSV genérico com colunas de data, descrição e valor (vírgula ou ponto e vírgula)
 */

import type { Category } from "./types";

export type FileKind = "ofx" | "csv-card" | "csv-account" | "csv";

export interface ParsedRow {
  /** identificador estável para não importar duas vezes */
  key: string;
  date: string; // YYYY-MM-DD
  description: string;
  /** valor com sinal do ponto de vista do arquivo */
  rawAmount: number; // centavos
}

export interface ParseResult {
  kind: FileKind;
  rows: ParsedRow[];
  /** o arquivo parece ser de cartão de crédito */
  looksLikeCard: boolean;
  warnings: string[];
}

/* ------------------------------- utilidades ------------------------------- */

/** Lê o arquivo tentando UTF-8 e, se vier com caracteres quebrados, Windows-1252 */
export async function readFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(buf);
  } catch {
    return utf8;
  }
}

/** "1.234,56" | "-1234.56" | "R$ 12,30" | "(12,30)" -> centavos */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/\s|R\$|"/g, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith("-")) {
    neg = !neg;
    s = s.slice(0, -1);
  }
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return neg ? -cents : cents;
}

/** aceita YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY e YYYYMMDD... (OFX) */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** chave para itens sem id no arquivo: data+valor+descrição (+ contador para repetidos) */
function makeKeys(rows: Omit<ParsedRow, "key">[], prefix: string, ids?: (string | null)[]): ParsedRow[] {
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const id = ids?.[i];
    if (id) return { ...r, key: `${prefix}:${id}` };
    const base = `${r.date}|${r.rawAmount}|${r.description.toLowerCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...r, key: `${prefix}:h${hash(base)}:${n}` };
  });
}

/* ---------------------------------- OFX ---------------------------------- */

function ofxTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : null;
}

function parseOFX(text: string): ParseResult {
  const looksLikeCard = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(text);
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const rows: Omit<ParsedRow, "key">[] = [];
  const ids: (string | null)[] = [];
  const warnings: string[] = [];
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const date = parseDate(ofxTag(block, "DTPOSTED") ?? "");
    const amount = parseAmount(ofxTag(block, "TRNAMT") ?? "");
    const desc = clean(ofxTag(block, "MEMO") || ofxTag(block, "NAME") || "");
    if (!date || amount == null) {
      warnings.push("Uma linha do OFX foi ignorada por estar incompleta.");
      continue;
    }
    rows.push({ date, description: desc || "Sem descrição", rawAmount: amount });
    ids.push(ofxTag(block, "FITID"));
  }
  return { kind: "ofx", rows: makeKeys(rows, "ofx", ids), looksLikeCard, warnings };
}

/* ---------------------------------- CSV ---------------------------------- */

function splitCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

function findCol(headers: string[], names: string[]): number {
  const h = headers.map(norm);
  for (const n of names) {
    const i = h.findIndex((x) => x === n);
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = h.findIndex((x) => x.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

function parseCSV(text: string): ParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { kind: "csv", rows: [], looksLikeCard: false, warnings: ["Arquivo vazio."] };

  const first = lines[0];
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitCSVLine(first, sep);

  const iDate = findCol(headers, ["data", "date", "data lancamento", "data da compra"]);
  const iDesc = findCol(headers, ["descricao", "title", "historico", "description", "estabelecimento", "memo", "lancamento"]);
  const iAmount = findCol(headers, ["valor", "amount", "value", "valor (r$)"]);
  const iId = findCol(headers, ["identificador", "id"]);

  if (iDate < 0 || iAmount < 0) {
    return {
      kind: "csv",
      rows: [],
      looksLikeCard: false,
      warnings: ["Não encontrei as colunas de data e valor nesse CSV."],
    };
  }

  const hNorm = headers.map(norm);
  const isNubankCard = hNorm.includes("title") && hNorm.includes("amount");
  const isNubankAccount = hNorm.includes("identificador");
  const kind: FileKind = isNubankCard ? "csv-card" : isNubankAccount ? "csv-account" : "csv";

  const rows: Omit<ParsedRow, "key">[] = [];
  const ids: (string | null)[] = [];
  const warnings: string[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCSVLine(line, sep);
    const date = parseDate(cols[iDate] ?? "");
    const amount = parseAmount(cols[iAmount] ?? "");
    if (!date || amount == null) continue;
    rows.push({ date, description: clean(iDesc >= 0 ? cols[iDesc] ?? "" : "") || "Sem descrição", rawAmount: amount });
    ids.push(iId >= 0 ? cols[iId] || null : null);
  }
  if (!rows.length) warnings.push("Nenhuma linha válida encontrada.");
  return { kind, rows: makeKeys(rows, "csv", ids), looksLikeCard: isNubankCard, warnings };
}

export function parseStatement(text: string, fileName: string): ParseResult {
  if (/<OFX>|OFXHEADER/i.test(text) || /\.ofx$/i.test(fileName)) return parseOFX(text);
  return parseCSV(text);
}

/**
 * Converte o valor do arquivo em despesa/receita para o destino escolhido.
 * - OFX: negativo = saída (vale para conta e cartão)
 * - CSV fatura Nubank: positivo = compra
 * - CSV de conta/genérico: negativo = saída
 */
export function interpret(kind: FileKind, rawAmount: number, invert: boolean) {
  let expense = kind === "csv-card" ? rawAmount > 0 : rawAmount < 0;
  if (invert) expense = !expense;
  return { type: expense ? ("expense" as const) : ("income" as const), amount: Math.abs(rawAmount) };
}

/** Pagamento de fatura / transferência entre contas próprias: vem desmarcado */
export function looksLikeInternal(description: string): boolean {
  const d = norm(description);
  return /pagamento (de fatura|recebido|da fatura)|pagamento fatura|fatura do cartao|resgate rdb|aplicacao rdb|dinheiro guardado|dinheiro resgatado/.test(d);
}

/* ------------------------ sugestão de categoria ------------------------ */

const RULES: { words: string[]; category: string; kind: "income" | "expense" }[] = [
  { kind: "expense", category: "Alimentação", words: ["ifood", "ifd", "rappi", "restaurante", "lanchonete", "padaria", "burger", "mcdonald", "bk ", "subway", "pizza", "acai", "cafe", "starbucks", "bar ", "churrasc", "sushi", "outback", "habib", "giraffas", "spoleto"] },
  { kind: "expense", category: "Mercado", words: ["mercado", "supermerc", "atacad", "assai", "carrefour", "extra", "pao de acucar", "dia ", "hortifruti", "sacolao", "big ", "makro", "sams club", "tenda"] },
  { kind: "expense", category: "Transporte", words: ["uber", "99app", "99 ", "99pop", "cabify", "posto", "shell", "ipiranga", "petrobras", "br mania", "combust", "estacion", "sem parar", "conectcar", "veloe", "metro", "bilhete", "onibus", "pedagio"] },
  { kind: "expense", category: "Assinaturas", words: ["netflix", "spotify", "disney", "hbo", "max.com", "prime video", "amazon prime", "youtube", "apple.com", "icloud", "google one", "deezer", "globoplay", "paramount", "crunchyroll", "chatgpt", "openai", "microsoft", "adobe", "canva"] },
  { kind: "expense", category: "Contas", words: ["energia", "enel", "cemig", "copel", "light", "sabesp", "agua", "saneamento", "claro", "vivo", "tim ", "oi ", "internet", "net servicos", "gas ", "comgas", "condominio", "boleto"] },
  { kind: "expense", category: "Saúde", words: ["farmacia", "drogaria", "droga", "raia", "pague menos", "panvel", "hospital", "clinica", "laborat", "unimed", "amil", "hapvida", "dentist", "odonto", "medic"] },
  { kind: "expense", category: "Compras", words: ["amazon", "mercadolivre", "mercado livre", "shopee", "magalu", "magazine", "americanas", "aliexpress", "shein", "renner", "riachuelo", "c&a", "zara", "centauro", "netshoes", "kabum", "casas bahia"] },
  { kind: "expense", category: "Lazer", words: ["cinema", "cinemark", "ingresso", "sympla", "steam", "playstation", "xbox", "nintendo", "show", "teatro", "parque"] },
  { kind: "expense", category: "Moradia", words: ["aluguel", "imobiliaria", "iptu", "quinto andar", "quintoandar"] },
  { kind: "expense", category: "Educação", words: ["escola", "faculdade", "universidade", "curso", "udemy", "alura", "livraria", "mensalidade"] },
  { kind: "income", category: "Salário", words: ["salario", "pagamento de salario", "folha", "proventos"] },
  { kind: "income", category: "Rendimentos", words: ["rendimento", "juros", "dividend", "rdb"] },
];

const LEARN_KEY = "nexvyra-finance:import-rules";

/** "Pix enviado - PADARIA DO ZÉ LTDA 123" -> "padaria do ze ltda" */
export function descriptionKey(desc: string): string {
  return norm(desc)
    .replace(/^(compra no debito|compra no credito|pix enviado|pix recebido|transferencia (enviada|recebida)( pelo pix)?|pagamento de boleto efetuado)\s*-?\s*/i, "")
    .replace(/[-–]\s*parcela \d+\/\d+/i, "")
    .replace(/\d{2,}/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export function loadLearned(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LEARN_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveLearned(map: Record<string, string>) {
  try {
    localStorage.setItem(LEARN_KEY, JSON.stringify(map));
  } catch {}
}

export function suggestCategory(
  description: string,
  type: "income" | "expense",
  categories: Category[],
  learned: Record<string, string>,
): string | null {
  const key = descriptionKey(description);
  const learnedId = key ? learned[key] : undefined;
  if (learnedId && categories.some((c) => c.id === learnedId && c.kind === type)) return learnedId;
  const d = ` ${norm(description)} `;
  for (const rule of RULES) {
    if (rule.kind !== type) continue;
    if (rule.words.some((w) => d.includes(w))) {
      const cat = categories.find((c) => c.kind === type && norm(c.name) === norm(rule.category));
      if (cat) return cat.id;
    }
  }
  return null;
}

/** "Pix enviado - Fulano" -> "Pix Fulano"; deixa a descrição mais curta e legível */
export function prettyDescription(desc: string): string {
  const s = clean(desc)
    .replace(/^Compra no (débito|debito|crédito|credito)\s*-\s*/i, "")
    .replace(/^Transfer[êe]ncia (enviada|recebida) pelo Pix\s*-\s*/i, "Pix ")
    .replace(/^Pix (enviado|recebido)\s*-\s*/i, "Pix ")
    .replace(/\s*-\s*•{3}\.\d{3}\.\d{3}-•{2}.*$/, "")
    .replace(/\s*-\s*\d{2,3}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*$/, "");
  const parts = s.split(" - ");
  const short = parts.length > 2 ? parts.slice(0, 2).join(" - ") : s;
  return short.length > 80 ? `${short.slice(0, 77)}...` : short;
}
