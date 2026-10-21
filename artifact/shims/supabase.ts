/* eslint-disable @typescript-eslint/no-explicit-any */
// Reemplazo mínimo del cliente de Supabase: cada tabla es una colección de los
// datos guardados del artifact, y cada fila un documento con el mismo id.
// Cubre solo las consultas que usa el panel.

import schema from "./schema.json";
import { getDb } from "./runtime";

type Row = Record<string, any>;
type Result<T = any> = { data: T; error: { message: string; code?: string } | null };

const COLUMNAS = schema as Record<string, string[]>;

// Valores por defecto que la base de datos ponía sola.
const DEFECTOS: Record<string, () => Row> = {
  tasks: () => ({
    category: "personal", is_meeting: false, is_deadline: false, priority: "media", is_focus: false,
    done: false, created_on: new Date().toISOString().slice(0, 10), from_weekly: false,
  }),
  critical_topics: () => ({ archived: false, frentes: [] }),
  critical_topic_task_proposals: () => ({ priority: "media", is_deadline: false, status: "pendiente" }),
  market_indicators_cache: () => ({ fetched_at: new Date().toISOString() }),
  profile: () => ({ content: "" }),
};

// Tablas cuya clave no es "id".
const CLAVE_DOC: Record<string, (r: Row) => string> = {
  market_indicators_cache: (r) => String(r.as_of),
  patrimonio_classes: (r) => String(r.code),
  patrimonio_class_totals: (r) => `${r.quarter_id}_${r.class_code}`,
  portfolio_sources: (r) => String(r.portfolio_key),
};

// select("*, hija(*)"): columna que une cada tabla hija con su padre.
const RELACIONES: Record<string, string> = {
  patrimonio_class_totals: "quarter_id",
  patrimonio_line_items: "quarter_id",
  investments_futalemu_positions: "snapshot_id",
  investment_account_positions: "account_id",
};

const nuevoId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const ahora = () => new Date().toISOString();

const colas = new Map<string, Promise<unknown>>();
function enCola<T>(ruta: string, fn: () => Promise<T>): Promise<T> {
  const previo = colas.get(ruta) ?? Promise.resolve();
  const sig = previo.catch(() => undefined).then(fn);
  colas.set(ruta, sig);
  return sig;
}

async function db() {
  const d = await getDb();
  if (!d) throw new Error("Los datos guardados no están disponibles en esta vista.");
  return d;
}

function completar(tabla: string, fila: Row): Row {
  const base: Row = {};
  for (const c of COLUMNAS[tabla] ?? []) base[c] = null;
  const out = { ...base, ...(DEFECTOS[tabla]?.() ?? {}), ...fila };
  if (!out.created_at && (COLUMNAS[tabla] ?? []).includes("created_at")) out.created_at = ahora();
  return out;
}

function docId(tabla: string, fila: Row): string {
  if (CLAVE_DOC[tabla]) return CLAVE_DOC[tabla](fila);
  return String(fila.id ?? nuevoId());
}

function limpio(fila: Row): Row {
  const { id: _id, ...resto } = fila;
  void _id;
  // Firestore-style: sin undefined
  return JSON.parse(JSON.stringify(resto));
}

export async function leerTabla(tabla: string): Promise<Row[]> {
  const d = await db();
  const snap = await d.collection(tabla).get();
  return snap.docs.map((x: any) => ({ id: x.id, ...x.data() }));
}

export async function escribirFila(tabla: string, fila: Row): Promise<Row> {
  const d = await db();
  const completa = completar(tabla, fila);
  const id = docId(tabla, completa);
  const conId = CLAVE_DOC[tabla] ? completa : { ...completa, id };
  await enCola(`${tabla}/${id}`, () => d.doc(`${tabla}/${id}`).set(limpio(conId)));
  return conId;
}

class Consulta implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private opts: any = null;
  private filtros: ((r: Row) => boolean)[] = [];
  private orden: { col: string; asc: boolean }[] = [];
  private tope: number | null = null;
  private modo: "uno" | "maybe" | null = null;
  private devuelve = false;
  private columnas = "*";

  constructor(private tabla: string) {}

  select(cols = "*") {
    if (this.op === "select") this.columnas = cols;
    else this.devuelve = true;
    return this;
  }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = rows; return this; }
  update(vals: Row) { this.op = "update"; this.payload = vals; return this; }
  delete() { this.op = "delete"; return this; }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) { this.op = "upsert"; this.payload = rows; this.opts = opts ?? null; return this; }
  eq(col: string, val: any) { this.filtros.push((r) => r[col] === val); return this; }
  not(col: string, op: string, val: any) {
    if (op === "is") this.filtros.push((r) => (val === null ? r[col] != null : r[col] !== val));
    else if (op === "eq") this.filtros.push((r) => r[col] !== val);
    return this;
  }
  neq(col: string, val: any) { this.filtros.push((r) => r[col] !== val); return this; }
  gte(col: string, val: any) { this.filtros.push((r) => r[col] != null && r[col] >= val); return this; }
  lte(col: string, val: any) { this.filtros.push((r) => r[col] != null && r[col] <= val); return this; }
  gt(col: string, val: any) { this.filtros.push((r) => r[col] != null && r[col] > val); return this; }
  lt(col: string, val: any) { this.filtros.push((r) => r[col] != null && r[col] < val); return this; }
  is(col: string, val: any) { this.filtros.push((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
  in(col: string, vals: any[]) { this.filtros.push((r) => vals.includes(r[col])); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orden.push({ col, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.tope = n; return this; }
  single() { this.modo = "uno"; return this; }
  maybeSingle() { this.modo = "maybe"; return this; }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, no?: ((e: any) => B | PromiseLike<B>) | null) {
    return this.ejecutar().then(ok, no);
  }

  private ordenar(filas: Row[]): Row[] {
    if (!this.orden.length) return filas;
    return [...filas].sort((a, b) => {
      for (const { col, asc } of this.orden) {
        const x = a[col], y = b[col];
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : 1) * (asc ? 1 : -1);
      }
      return 0;
    });
  }

  private async unirHijas(filas: Row[]): Promise<Row[]> {
    const hijas = [...this.columnas.matchAll(/(\w+)\(\*\)/g)].map((m) => m[1]);
    if (!hijas.length) return filas;
    const out = filas.map((f) => ({ ...f }));
    for (const hija of hijas) {
      const fk = RELACIONES[hija];
      if (!fk) continue;
      const hijasFilas = await leerTabla(hija);
      for (const f of out) f[hija] = hijasFilas.filter((h) => h[fk] === f.id);
    }
    return out;
  }

  private final(filas: Row[]): Result {
    if (this.modo) {
      const uno = filas[0] ?? null;
      return { data: uno, error: this.modo === "uno" && !uno ? { message: "Sin resultados", code: "PGRST116" } : null };
    }
    return { data: filas, error: null };
  }

  private async ejecutar(): Promise<Result> {
    try {
      const t = this.tabla;
      if (this.op === "select") {
        let filas = (await leerTabla(t)).filter((r) => this.filtros.every((f) => f(r)));
        filas = this.ordenar(filas);
        if (this.tope != null) filas = filas.slice(0, this.tope);
        filas = await this.unirHijas(filas);
        return this.final(filas);
      }
      if (this.op === "insert") {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
        const hechas: Row[] = [];
        for (const r of rows) hechas.push(await escribirFila(t, r));
        return this.devuelve ? this.final(hechas) : { data: null, error: null };
      }
      if (this.op === "upsert") {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Row[];
        const claves = String(this.opts?.onConflict ?? "id").split(",").map((s) => s.trim()).filter((c) => c !== "user_id");
        const existentes = await leerTabla(t);
        const hechas: Row[] = [];
        for (const r of rows) {
          const previa = existentes.find((e) => claves.every((c) => e[c] === r[c] && e[c] !== undefined));
          hechas.push(await escribirFila(t, previa ? { ...previa, ...r, id: previa.id } : r));
        }
        return this.devuelve ? this.final(hechas) : { data: null, error: null };
      }
      const objetivo = (await leerTabla(t)).filter((r) => this.filtros.every((f) => f(r)));
      const d = await db();
      if (this.op === "update") {
        const hechas: Row[] = [];
        for (const r of objetivo) {
          const nueva = { ...r, ...this.payload };
          await enCola(`${t}/${r.id}`, () => d.doc(`${t}/${r.id}`).set(limpio(nueva)));
          hechas.push(nueva);
        }
        return this.devuelve ? this.final(hechas) : { data: null, error: null };
      }
      for (const r of objetivo) await enCola(`${t}/${r.id}`, () => d.doc(`${t}/${r.id}`).delete());
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e), code: e?.code } };
    }
  }
}

const cliente = {
  from: (tabla: string) => new Consulta(tabla),
  auth: {
    getUser: async () => ({ data: { user: { id: "dueño" } }, error: null }),
    signOut: async () => ({ error: null }),
  },
};

export function createClient() {
  return cliente;
}
