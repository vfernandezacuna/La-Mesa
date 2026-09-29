import Papa from "papaparse";

/**
 * Lee una hoja de Google Sheets pública ("Cualquiera con el link puede
 * ver") como CSV, sin credenciales — vía la URL de exportación pública.
 * `gid` identifica la pestaña exacta (aparece en la URL de la hoja
 * después de "#gid="); si se omite, se exporta la primera pestaña.
 */
export async function fetchSheetCsv(spreadsheetId: string, gid?: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?format=csv${
    gid ? `&gid=${encodeURIComponent(gid)}` : ""
  }`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Error al leer Google Sheets (${res.status}). Verificá que la hoja esté compartida como "Cualquiera con el link puede ver".`,
    );
  }
  return res.text();
}

/** Parsea CSV a filas de strings, manejando comillas y comas embebidas. */
export function parseSheetCsv(csv: string): string[][] {
  const result = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  return result.data;
}
