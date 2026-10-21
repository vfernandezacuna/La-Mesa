/* eslint-disable @typescript-eslint/no-explicit-any */
import Papa from "papaparse";
import { getMcp } from "./runtime";

const SERVIDOR = "Google Sheets";

// Lee una pestaña de Google Sheets con el conector de Google de quien abre la
// página (no hace falta que la hoja sea pública) y la devuelve como CSV, que es
// lo que esperan los lectores de las planillas.
export async function fetchSheetCsv(spreadsheetId: string, gid?: string): Promise<string> {
  const mcp = await getMcp();
  if (!mcp) throw new Error("El conector de Google Sheets no está disponible en esta vista. Conéctalo en claude.ai y vuelve a abrir la página.");
  try {
    const meta: any = await mcp.callTool(SERVIDOR, "get_spreadsheet", {
      spreadsheetId,
      fields: ["sheets.properties.sheetId", "sheets.properties.title"],
    });
    const hojas: any[] = meta?.payload?.sheets ?? [];
    const elegida = (gid ? hojas.find((h) => String(h.properties?.sheetId) === String(gid)) : null) ?? hojas[0];
    const titulo: string | undefined = elegida?.properties?.title;
    if (!titulo) throw new Error("No encontré la pestaña de la planilla.");
    const vals: any = await mcp.callTool(SERVIDOR, "get_values", { spreadsheetId, range: `'${titulo.replace(/'/g, "''")}'` });
    const filas: string[][] = vals?.payload?.values ?? [];
    if (!filas.length) throw new Error("La pestaña está vacía.");
    return Papa.unparse(filas);
  } catch (e: any) {
    if (e?.code === "not_granted" || e?.code === "approval_required") {
      throw new Error("Falta permitir el acceso a Google Sheets para esta página.");
    }
    throw new Error(e?.message ? `Error al leer Google Sheets: ${e.message}` : "Error al leer Google Sheets.");
  }
}

/** Parsea CSV a filas de strings, manejando comillas y comas embebidas. */
export function parseSheetCsv(csv: string): string[][] {
  const result = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  return result.data;
}
