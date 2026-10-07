// Lectura en el navegador de los archivos que se adjuntan como material:
// correos (.eml, .msg), planillas (.xlsx, .csv) y los adjuntos que traen los
// correos. Todo se convierte a texto; los PDF e imágenes se devuelven aparte
// para que los lea Claude directamente.

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

async function leerXlsx(nombre: string, datos: File | Blob): Promise<string> {
  const { default: readExcelFile } = await import("read-excel-file/universal");
  const hojas = (await readExcelFile(datos)) as { sheet: string; data: unknown[][] }[];
  const partes = hojas.slice(0, MAX_HOJAS).map((h) => hojaATexto(h.sheet, h.data));
  const extra = hojas.length > MAX_HOJAS ? `\n[…${hojas.length - MAX_HOJAS} hojas más no se leyeron]` : "";
  return `[Planilla ${nombre}]\n${partes.join("\n\n")}${extra}`;
}

async function leerCsv(nombre: string, file: File): Promise<string> {
  const texto = await file.text();
  const corto = texto.length > MAX_CARACTERES_POR_HOJA ? `${texto.slice(0, MAX_CARACTERES_POR_HOJA)}\n[…recortado]` : texto;
  return `[Planilla ${nombre}]\n${corto}`;
}

// Los correos de Outlook suelen traer el Excel como enlace de SharePoint o
// OneDrive y no como adjunto: ese contenido no se puede leer desde aquí.
const AVISO_ENLACE =
  "El correo trae la planilla Excel como enlace (SharePoint u OneDrive), no como adjunto, así que no pude leer sus cifras. Descárgala y adjúntala junto al correo.";

function planillaSoloComoEnlace(cuerpo: string, salida: MaterialLeido): boolean {
  const leyoPlanilla = salida.textos.some((t) => t.startsWith("[Planilla"));
  return !leyoPlanilla && /(sharepoint\.com|onedrive|1drv\.ms)/i.test(cuerpo) && /(\.xlsx|\/:x:\/)/i.test(cuerpo);
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
): Promise<void> {
  const tipo = tipoDeAdjunto(nombre, mime);
  if (tipo === "xlsx") {
    try {
      const blob = new Blob([bytes as BlobPart], { type: mime || "application/octet-stream" });
      salida.textos.push(await leerXlsx(nombre, blob));
    } catch {
      salida.textos.push(`[Planilla ${nombre}: no se pudo leer; revisa que sea un .xlsx válido]`);
    }
  } else if (tipo === "pdf") {
    salida.binarios.push({ name: nombre, base64: aBase64(bytes), mediaType: "application/pdf" });
  } else if (tipo === "imagen" && bytes.length > 20000) {
    // las imágenes chicas son firmas y logos del correo; se ignoran
    salida.binarios.push({ name: nombre, base64: aBase64(bytes), mediaType: mime });
  }
}

async function leerEml(file: File): Promise<MaterialLeido> {
  const { default: PostalMime } = await import("postal-mime");
  const email = await PostalMime.parse(await file.arrayBuffer());
  const salida: MaterialLeido = { textos: [], binarios: [] };

  const cuerpo = (email.text?.trim() || (email.html ? textoDeHtml(email.html) : "")).slice(0, MAX_CARACTERES_CORREO);
  const de = email.from?.name || email.from?.address || "";
  salida.textos.push(
    `[Correo "${email.subject ?? file.name}"${de ? ` · de ${de}` : ""}${email.date ? ` · ${email.date.slice(0, 10)}` : ""}]\n${cuerpo}`,
  );

  for (const adj of email.attachments ?? []) {
    if (!adj.filename && !adj.mimeType) continue;
    await procesarAdjunto(adj.filename ?? "adjunto", adj.mimeType ?? "", bytesDe(adj.content), salida);
  }
  if (planillaSoloComoEnlace(`${email.text ?? ""} ${email.html ?? ""}`, salida)) salida.avisos = [AVISO_ENLACE];
  return salida;
}

async function leerMsg(file: File): Promise<MaterialLeido> {
  const { default: MsgReader } = await import("@kenjiuno/msgreader");
  const lector = new MsgReader(await file.arrayBuffer());
  const datos = lector.getFileData() as unknown as Record<string, unknown> & { attachments?: unknown[] };
  const salida: MaterialLeido = { textos: [], binarios: [] };

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

  for (let i = 0; i < (datos.attachments?.length ?? 0); i++) {
    try {
      const adj = lector.getAttachment(i);
      const bytes = adj.content;
      await procesarAdjunto(adj.fileName ?? "adjunto", "", bytes, salida);
    } catch {
      // adjunto ilegible: se omite
    }
  }
  if (planillaSoloComoEnlace(cuerpo, salida)) salida.avisos = [AVISO_ENLACE];
  return salida;
}

/** Lee un correo (.eml o .msg) o una planilla (.xlsx o .csv) y todo lo que traiga. */
export async function leerArchivoDeReporte(file: File): Promise<MaterialLeido> {
  if (/\.eml$/i.test(file.name)) return leerEml(file);
  if (/\.msg$/i.test(file.name)) return leerMsg(file);
  if (/\.xlsx$/i.test(file.name)) return { textos: [await leerXlsx(file.name, file)], binarios: [] };
  return { textos: [await leerCsv(file.name, file)], binarios: [] };
}
