// Lectura en el navegador de los archivos que se adjuntan como material:
// correos (.eml, .msg), planillas (.xlsx, .csv) y los adjuntos que traen los
// correos. Todo se convierte a texto; los PDF e imágenes se devuelven aparte
// para que los lea Claude directamente.

import { leerHojaIncremental, type HojaGuardada } from "./hoja-diff";
import { cargarHoja } from "./hoja-store";

export interface AdjuntoBinario {
  name: string;
  base64: string;
  mediaType: string;
}

export interface MaterialLeido {
  /** Texto ya legible (cuerpo del correo, planillas) con su rótulo. */
  textos: string[];
  /** PDF e imágenes (sueltos o adjuntos de un correo) para que los lea Claude. */
  binarios: AdjuntoBinario[];
  /** Cosas que el usuario debería saber, p. ej. que la planilla venía solo como enlace. */
  avisos?: string[];
  /** Qué se leyó de cada archivo (o por qué no se pudo), para mostrárselo al usuario. */
  notas: string[];
  /** Cuántas planillas se alcanzaron a leer. */
  planillasLeidas: number;
  /** Estado de las hojas largas recién leídas; se guarda cuando el material queda archivado. */
  hojas: HojaPorGuardar[];
}

export interface HojaPorGuardar {
  clave: string;
  hoja: Omit<HojaGuardada, "entryId">;
}

export interface OpcionesLectura {
  /** Tema al que se adjunta: las hojas largas se comparan contra su última lectura. */
  topicId: string;
  /** Entradas que hoy existen en el historial del tema (si se borró la que guardó una hoja, se relee completa). */
  entradasVigentes: Set<string>;
}

const MAX_FILAS_POR_HOJA = 400;
const MAX_CARACTERES_POR_HOJA = 14000;
const MAX_HOJAS = 6;
const MAX_CARACTERES_CORREO = 12000;

export const EXTENSIONES_CORREO = /\.(eml|msg)$/i;
export const EXTENSIONES_PLANILLA = /\.(xlsx|csv)$/i;

function aBase64(bytes: Uint8Array): string {
  let bin = "";
  const paso = 0x8000;
  for (let i = 0; i < bytes.length; i += paso) {
    bin += String.fromCharCode(...bytes.subarray(i, i + paso));
  }
  return btoa(bin);
}

function bytesDe(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof content === "string") return new TextEncoder().encode(content);
  return content instanceof Uint8Array ? content : new Uint8Array(content);
}

function textoDeHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function celda(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toLocaleDateString("es-CL");
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000);
  return String(v).replace(/\s+/g, " ").trim();
}

function hojaATexto(nombre: string, filas: unknown[][]): string {
  const lineas: string[] = [];
  let largo = 0;
  for (const fila of filas.slice(0, MAX_FILAS_POR_HOJA)) {
    const celdas = fila.map(celda);
    while (celdas.length && !celdas[celdas.length - 1]) celdas.pop();
    if (!celdas.length) continue;
    const linea = celdas.join(" | ");
    largo += linea.length + 1;
    if (largo > MAX_CARACTERES_POR_HOJA) {
      lineas.push("[…hoja recortada]");
      break;
    }
    lineas.push(linea);
  }
  return `[Hoja "${nombre}"]\n${lineas.join("\n")}`;
}

const MB = 1024 * 1024;
const MAX_BYTES_XLSX = 80 * MB;
const MAX_BYTES_LIVIANO = 6 * MB;
const prioritaria = (n: string) => /conteo|resumen|mes|semana|proyecci/i.test(n);

function decodificarXml(v: string): string {
  return v
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

// Los nombres de las hojas se sacan del workbook.xml sin descomprimir el resto
// del archivo, para poder leer solo las hojas que importan.
async function nombresDeHojas(buf: ArrayBuffer): Promise<string[]> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const partes = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === "xl/workbook.xml" });
  const xml = partes["xl/workbook.xml"];
  if (!xml) return [];
  return [...strFromU8(xml).matchAll(/<sheet\b[^>]*?\bname="([^"]*)"/g)].map((m) => decodificarXml(m[1]));
}

const normHoja = (n: string) =>
  n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Reporte semanal de la PMO: solo se leen estas pestañas. Las dos largas arrastran
// datos desde el inicio del proyecto, así que se leen de forma incremental.
const HOJAS_PMO: { re: RegExp; largo: boolean }[] = [
  { re: /^fechas? lib/, largo: true },
  { re: /^pas\b.*torre/, largo: true },
  { re: /^conteo/, largo: false },
  { re: /^resumen/, largo: false },
];
const hojaPmo = (n: string) => HOJAS_PMO.find((h) => h.re.test(normHoja(n)));

// Un Excel pesado casi siempre lo es por hojas enormes (detalle por estructura)
// o por imágenes. Si el archivo trae las pestañas del reporte de la PMO, se leen
// solo esas; si no, se leen primero las de conteo o resumen y las demás solo si
// el archivo es liviano.
async function leerXlsx(
  nombre: string,
  datos: Blob,
  opciones?: OpcionesLectura,
): Promise<{ texto: string; nota: string; hojas: HojaPorGuardar[] }> {
  if (datos.size > MAX_BYTES_XLSX) {
    throw new Error(`pesa ${(datos.size / MB).toFixed(0)} MB, demasiado para leerlo desde el navegador`);
  }
  const { readSheet } = await import("read-excel-file/universal");
  const todas = await nombresDeHojas(await datos.arrayBuffer());
  const delReporte = todas.filter((n) => hojaPmo(n));
  const prioritarias = todas.filter(prioritaria);
  const liviano = datos.size <= MAX_BYTES_LIVIANO;
  const elegidas = (
    delReporte.length
      ? delReporte
      : prioritarias.length
        ? liviano
          ? [...prioritarias, ...todas.filter((n) => !prioritarias.includes(n))]
          : prioritarias.slice(0, 3)
        : liviano
          ? todas
          : todas.slice(0, 1)
  ).slice(0, MAX_HOJAS);
  if (!elegidas.length) throw new Error("no encontré hojas dentro del archivo");

  const partes: string[] = [];
  const notas: string[] = [];
  const hojas: HojaPorGuardar[] = [];
  const leidas: string[] = [];
  for (const hoja of elegidas) {
    try {
      const filas = (await readSheet(datos, hoja)) as unknown[][];
      const config = delReporte.length ? hojaPmo(hoja) : undefined;
      if (config?.largo && opciones) {
        const clave = `${opciones.topicId}|${normHoja(hoja)}`;
        const previa = await cargarHoja(clave);
        const vigente = previa && opciones.entradasVigentes.has(previa.entryId) ? previa : null;
        const r = leerHojaIncremental(
          hoja,
          filas.map((f) => f.map(celda)),
          vigente,
        );
        partes.push(r.texto);
        notas.push(r.nota);
        hojas.push({ clave, hoja: r.guardar });
      } else {
        partes.push(hojaATexto(hoja, filas));
      }
      leidas.push(hoja);
    } catch {
      // una hoja que falla no impide leer las demás
    }
  }
  if (!partes.length) throw new Error("no se pudo leer ninguna hoja");
  const ignoradas = todas.filter((n) => !leidas.includes(n));
  const resumen = `Planilla ${nombre}: leí ${leidas.length} de ${todas.length} hojas (${leidas.join(", ")})${ignoradas.length ? `; ignoré ${ignoradas.length}` : ""}.`;
  const extra = ignoradas.length ? `\n[Hojas no leídas: ${ignoradas.join(", ")}]` : "";
  return { texto: `[Planilla ${nombre}]\n${partes.join("\n\n")}${extra}`, nota: [resumen, ...notas].join("\n"), hojas };
}

async function leerCsv(nombre: string, file: File): Promise<{ texto: string; nota: string }> {
  const texto = await file.text();
  const corto = texto.length > MAX_CARACTERES_POR_HOJA ? `${texto.slice(0, MAX_CARACTERES_POR_HOJA)}\n[…recortado]` : texto;
  return { texto: `[Planilla ${nombre}]\n${corto}`, nota: `Planilla ${nombre}: leída.` };
}

// Los correos de Outlook suelen traer el Excel como enlace de SharePoint o
// OneDrive y no como adjunto: ese contenido no se puede leer desde aquí.
const AVISO_ENLACE =
  "El correo trae la planilla Excel como enlace (SharePoint u OneDrive), no como adjunto, así que no pude leer sus cifras. Descárgala y adjúntala junto al correo.";

function planillaSoloComoEnlace(cuerpo: string, salida: MaterialLeido): boolean {
  return salida.planillasLeidas === 0 && /(sharepoint\.com|onedrive|1drv\.ms)/i.test(cuerpo) && /(\.xlsx|\/:x:\/)/i.test(cuerpo);
}

function tipoDeAdjunto(nombre: string, mime: string): "xlsx" | "pdf" | "imagen" | null {
  if (/\.xlsx$/i.test(nombre) || /spreadsheetml/.test(mime)) return "xlsx";
  if (/\.pdf$/i.test(nombre) || mime === "application/pdf") return "pdf";
  if (/^image\/(png|jpe?g|webp|gif)$/.test(mime)) return "imagen";
  return null;
}

async function procesarAdjunto(
  nombre: string,
  mime: string,
  bytes: Uint8Array,
  salida: MaterialLeido,
  opciones?: OpcionesLectura,
): Promise<void> {
  const tipo = tipoDeAdjunto(nombre, mime);
  if (tipo === "xlsx") {
    try {
      const blob = new Blob([bytes as BlobPart], { type: mime || "application/octet-stream" });
      const { texto, nota, hojas } = await leerXlsx(nombre, blob, opciones);
      salida.textos.push(texto);
      salida.notas.push(...nota.split("\n"));
      salida.hojas.push(...hojas);
      salida.planillasLeidas++;
    } catch (err) {
      salida.notas.push(`⚠ Planilla ${nombre}: no se pudo leer (${err instanceof Error ? err.message : "error"}). Prueba exportando la hoja "Conteo - Mes" a CSV y adjuntándola.`);
    }
  } else if (tipo === "pdf") {
    salida.binarios.push({ name: nombre, base64: aBase64(bytes), mediaType: "application/pdf" });
  } else if (tipo === "imagen" && bytes.length > 20000) {
    // las imágenes chicas son firmas y logos del correo; se ignoran
    salida.binarios.push({ name: nombre, base64: aBase64(bytes), mediaType: mime });
  }
}

async function leerEml(file: File, opciones?: OpcionesLectura): Promise<MaterialLeido> {
  const { default: PostalMime } = await import("postal-mime");
  const email = await PostalMime.parse(await file.arrayBuffer());
  const salida: MaterialLeido = { textos: [], binarios: [], notas: [], planillasLeidas: 0, hojas: [] };

  const cuerpo = (email.text?.trim() || (email.html ? textoDeHtml(email.html) : "")).slice(0, MAX_CARACTERES_CORREO);
  const de = email.from?.name || email.from?.address || "";
  salida.textos.push(
    `[Correo "${email.subject ?? file.name}"${de ? ` · de ${de}` : ""}${email.date ? ` · ${email.date.slice(0, 10)}` : ""}]\n${cuerpo}`,
  );

  salida.notas.push(`Correo «${email.subject ?? file.name}»: leído.`);
  for (const adj of email.attachments ?? []) {
    if (!adj.filename && !adj.mimeType) continue;
    await procesarAdjunto(adj.filename ?? "adjunto", adj.mimeType ?? "", bytesDe(adj.content), salida, opciones);
  }
  if (planillaSoloComoEnlace(`${email.text ?? ""} ${email.html ?? ""}`, salida)) salida.avisos = [AVISO_ENLACE];
  return salida;
}

async function leerMsg(file: File, opciones?: OpcionesLectura): Promise<MaterialLeido> {
  const { default: MsgReader } = await import("@kenjiuno/msgreader");
  const lector = new MsgReader(await file.arrayBuffer());
  const datos = lector.getFileData() as unknown as Record<string, unknown> & { attachments?: unknown[] };
  const salida: MaterialLeido = { textos: [], binarios: [], notas: [], planillasLeidas: 0, hojas: [] };

  const asunto = typeof datos.subject === "string" ? datos.subject : file.name;
  const de = typeof datos.senderName === "string" ? datos.senderName : "";
  const fecha =
    typeof datos.messageDeliveryTime === "string"
      ? datos.messageDeliveryTime
      : typeof datos.clientSubmitTime === "string"
        ? datos.clientSubmitTime
        : "";
  const cuerpo = (typeof datos.body === "string" ? datos.body : "").trim().slice(0, MAX_CARACTERES_CORREO);
  salida.textos.push(
    `[Correo "${asunto}"${de ? ` · de ${de}` : ""}${fecha ? ` · ${new Date(fecha).toISOString().slice(0, 10)}` : ""}]\n${cuerpo}`,
  );

  salida.notas.push(`Correo «${asunto}»: leído.`);
  for (let i = 0; i < (datos.attachments?.length ?? 0); i++) {
    try {
      const adj = lector.getAttachment(i);
      const bytes = adj.content;
      await procesarAdjunto(adj.fileName ?? "adjunto", "", bytes, salida, opciones);
    } catch {
      // adjunto ilegible: se omite
    }
  }
  if (planillaSoloComoEnlace(cuerpo, salida)) salida.avisos = [AVISO_ENLACE];
  return salida;
}

/** Lee un correo (.eml o .msg) o una planilla (.xlsx o .csv) y todo lo que traiga. */
export async function leerArchivoDeReporte(file: File, opciones?: OpcionesLectura): Promise<MaterialLeido> {
  const vacio: MaterialLeido = { textos: [], binarios: [], notas: [], planillasLeidas: 0, hojas: [] };
  try {
    if (/\.eml$/i.test(file.name)) return await leerEml(file, opciones);
    if (/\.msg$/i.test(file.name)) return await leerMsg(file, opciones);
    if (/\.xlsx$/i.test(file.name)) {
      const { texto, nota, hojas } = await leerXlsx(file.name, file, opciones);
      return { ...vacio, textos: [texto], notas: nota.split("\n"), planillasLeidas: 1, hojas };
    }
    const { texto, nota } = await leerCsv(file.name, file);
    return { ...vacio, textos: [texto], notas: [nota], planillasLeidas: 1 };
  } catch (err) {
    const motivo = err instanceof Error ? err.message : "error desconocido";
    const sugerencia = /\.xlsx$/i.test(file.name)
      ? ' Prueba exportando la hoja "Conteo - Mes" a CSV y adjuntándola.'
      : "";
    return { ...vacio, notas: [`⚠ ${file.name}: no se pudo leer (${motivo}).${sugerencia}`] };
  }
}
