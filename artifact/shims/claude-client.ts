/* eslint-disable @typescript-eslint/no-explicit-any */
// Reemplazo del cliente de Claude: en el artifact las consultas salen por la
// capacidad "sample", que usa la suscripción de Claude de quien abre la página
// (no hay clave de API ni crédito aparte).

import { getSample } from "./runtime";
import { leerTabla } from "./supabase";

export type Effort = "low" | "medium" | "high";

function mensajeDe(e: any): string {
  const code = e?.code;
  if (code === "not_granted" || code === "capability_disabled") {
    return "Claude no está habilitado en esta página. Acepta el permiso cuando se te pida.";
  }
  if (code === "rate_limited") return "Claude está limitando el uso por ahora. Intenta de nuevo en unos minutos.";
  return e?.message ? String(e.message) : "Claude no respondió.";
}

async function preguntar(system: string, user: string, effort?: Effort, images?: Blob[]): Promise<string> {
  const sample = await getSample();
  if (!sample) throw new Error("Claude no está disponible en esta vista.");
  const entrada = `${system}\n\n=== MATERIAL ===\n${user}`;
  try {
    const opts: Record<string, unknown> = { modelTier: effort === "low" ? "quick" : "default", cache: false };
    if (images?.length) opts.images = images;
    const r = await sample(entrada, opts);
    return String(r?.text ?? "").trim();
  } catch (e) {
    throw new Error(mensajeDe(e));
  }
}

// maxTokens ya no se aplica: la capacidad decide el largo de la respuesta.
export async function askClaude(system: string, user: string, _maxTokens = 1200, effort?: Effort): Promise<string> {
  void _maxTokens;
  return preguntar(system, user, effort);
}

// Sin acceso web en vivo: responde con lo que Claude sabe y lo dice.
export async function askClaudeWeb(system: string, user: string, _maxTokens = 2000, _maxSearches = 5): Promise<string> {
  void _maxTokens;
  void _maxSearches;
  return preguntar(
    `${system}\n\nIMPORTANTE: en esta versión no tienes acceso a internet en vivo. Trabaja solo con lo que sabes y con el material que te doy, e indica con claridad que los datos de mercado pueden no estar actualizados al día de hoy.`,
    user,
  );
}

function base64ABytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let pdfJs: Promise<any> | null = null;
function cargarPdfJs(): Promise<any> {
  if (pdfJs) return pdfJs;
  pdfJs = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.pdfjsLib) return resolve(w.pdfjsLib);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(w.pdfjsLib);
    };
    s.onerror = () => reject(new Error("No se pudo cargar el lector de PDF."));
    document.head.appendChild(s);
  });
  return pdfJs;
}

async function textoDePdf(base64: string): Promise<string> {
  const lib = await cargarPdfJs();
  const pdf = await lib.getDocument({ data: base64ABytes(base64) }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    paginas.push(content.items.map((it: any) => it.str).join(" "));
  }
  return paginas.join("\n\n").trim();
}

export async function askClaudeWithPdf(system: string, base64Pdf: string, userText: string, _maxTokens = 2000): Promise<string> {
  void _maxTokens;
  let texto = "";
  try {
    texto = await textoDePdf(base64Pdf);
  } catch {
    throw new Error("No se pudo leer el PDF desde esta página. Pega el texto o súbelo como foto.");
  }
  if (!texto) throw new Error("El PDF no trae texto (parece escaneado). Súbelo como foto o pega el texto.");
  return preguntar(system, `${userText}\n\n[Texto del PDF]\n${texto.slice(0, 120000)}`, "low");
}

export async function askClaudeWithFile(
  system: string,
  base64Data: string,
  mediaType: string,
  userText: string,
  _maxTokens = 2000,
): Promise<string> {
  void _maxTokens;
  if (mediaType === "application/pdf") return askClaudeWithPdf(system, base64Data, userText);
  const blob = new Blob([base64ABytes(base64Data) as BlobPart], { type: mediaType });
  return preguntar(system, userText, "low", [blob]);
}

// UF y dólar del día: se leen de lo que cargaste en la barra lateral.
export async function obtenerIndicadores(fecha: string, _refresh = false): Promise<{
  as_of: string;
  uf: number;
  dolar: number;
  fetched_at: string;
}> {
  void _refresh;
  const filas = await leerTabla("market_indicators_cache");
  const hoy = filas.find((f) => f.as_of === fecha);
  const fila = hoy ?? [...filas].sort((a, b) => String(b.as_of).localeCompare(String(a.as_of)))[0];
  if (!fila?.uf) throw new Error("Carga la UF y el dólar en la barra lateral para ver las equivalencias.");
  return { as_of: fila.as_of, uf: Number(fila.uf), dolar: Number(fila.dolar), fetched_at: fila.fetched_at ?? "" };
}
